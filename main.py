import logging
import os
import re
import time
from pathlib import Path
from logging.handlers import RotatingFileHandler
from urllib.parse import parse_qs, urlparse
from typing import Optional
from html import unescape

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import requests
from bs4 import BeautifulSoup

app = FastAPI()
BASE_DIR = Path(__file__).resolve().parent
REACT_DIST_DIR = BASE_DIR / "react _frontend" / "dist"
REACT_INDEX_FILE = REACT_DIST_DIR / "index.html"
REACT_ASSETS_DIR = REACT_DIST_DIR / "assets"
EPOS_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}
EPOS_TIMEOUT = (5, 15)
TRANSACTIONS_CACHE_TTL_SECONDS = 300
TRANSACTIONS_CACHE = {}
FPS_DEALER_CACHE_TTL_SECONDS = 3600
FPS_DEALER_CACHE = {}
EPOS_SESSION = requests.Session()
EPOS_SESSION.headers.update(EPOS_HEADERS)

if REACT_ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=REACT_ASSETS_DIR), name="assets")

logger = logging.getLogger("ration-backend")
logger.setLevel(logging.INFO)

log_formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

if not logger.handlers:
    logger.addHandler(console_handler)
    if not os.environ.get("VERCEL"):
        try:
            file_handler = RotatingFileHandler(
                "backend.log",
                maxBytes=1_000_000,
                backupCount=3,
                encoding="utf-8",
            )
            file_handler.setFormatter(log_formatter)
            logger.addHandler(file_handler)
        except OSError as exc:
            logger.warning("file_logging_disabled reason=%s", exc)

# Allow the Vite dev server (and fallback to any origin during development) to hit the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StockRequest(BaseModel):
    fps_id: int
    month: int
    year: int
    rice_bag_weight: float = Field(default=50, gt=0)
    wheat_bag_weight: float = Field(default=50, gt=0)
    sugar_bag_weight: float = Field(default=50, gt=0)
    atta_bag_weight: float = Field(default=50, gt=0)


class TransactionsRequest(BaseModel):
    from_date: str
    to_date: str
    dist_code: int
    afso: int
    fps_id: int
    month: int
    year: int


class StockRegisterRequest(BaseModel):
    dist_code: int
    fps_id: int
    month: int
    year: int
    office_code: int


class RoDetailsRequest(BaseModel):
    month: int
    year: int
    shop_no: int
    dist_code: int
    depot_id: str


class RoQuantityDetailsRequest(BaseModel):
    release_order_id_aso: Optional[str] = ""
    ro_no: str
    month_int: Optional[int] = None
    year_int: Optional[int] = None
    ro_date: Optional[str] = ""
    shop_number: Optional[int] = None
    district_code: Optional[int] = None
    truckchit_number: Optional[str] = ""


SCM_RO_DETAIL_KEYS = {
    "release_order_id_aso",
    "ro_no",
    "month_int",
    "year_int",
    "ro_date",
    "shop_number",
    "district_code",
    "truckchit_number",
}

RO_NO_PATTERN = re.compile(r"RO/[A-Z]+/\d+/\d+/\d+/\d+/\d+", re.IGNORECASE)


def is_javascript_placeholder(value: str):
    lowered = (value or "").strip().lower()
    return (
        not lowered
        or "(" in lowered
        or ")" in lowered
        or lowered in {"ro_no", "month", "year", "shop_no", "dist_code"}
        or lowered.startswith("escape")
    )


def clean_scm_param_value(value: str):
    cleaned = unescape(str(value or ""))
    cleaned = cleaned.split("<", 1)[0].strip().strip("'\"")
    return cleaned.rstrip(";").strip()


def extract_scm_detail_params(raw_value: str):
    if not raw_value:
        return {}

    parsed = urlparse(raw_value)
    query = parsed.query or raw_value
    parsed_params = parse_qs(query, keep_blank_values=True)
    params = {
        key: clean_scm_param_value(values[0])
        for key, values in parsed_params.items()
        if key in SCM_RO_DETAIL_KEYS and values
    }

    if params:
        return params

    params = {}
    for key in SCM_RO_DETAIL_KEYS:
        match = re.search(rf"{re.escape(key)}\s*=\s*([^&'\"\s)]+)", raw_value)
        if match:
            params[key] = clean_scm_param_value(match.group(1))
    if params:
        return params

    quoted_values = re.findall(r"'([^']*)'|\"([^\"]*)\"", raw_value)
    positional_values = [single or double for single, double in quoted_values]
    if len(positional_values) >= 8:
        ordered_keys = [
            "release_order_id_aso",
            "ro_no",
            "month_int",
            "year_int",
            "ro_date",
            "shop_number",
            "district_code",
            "truckchit_number",
        ]
        return {
            key: clean_scm_param_value(value)
            for key, value in zip(ordered_keys, positional_values[:8])
        }

    return {}


def extract_scm_actions_by_ro_no(html: str):
    decoded = unescape(html or "")
    actions = {}

    for match in RO_NO_PATTERN.finditer(decoded):
        ro_no = match.group(0)
        start = max(match.start() - 2500, 0)
        end = min(match.end() + 2500, len(decoded))
        context = decoded[start:end]
        params = extract_scm_detail_params(context) or {}
        params = {
            key: value
            for key, value in params.items()
            if not is_javascript_placeholder(str(value))
        }
        params["ro_no"] = ro_no

        if not params.get("release_order_id_aso"):
            id_match = re.search(
                r"release_order_id_aso\s*[:=]\s*['\"]?(\d+)",
                context,
                re.IGNORECASE,
            )
            if id_match:
                params["release_order_id_aso"] = id_match.group(1)

        if not params.get("release_order_id_aso") and (
            "ro_quantity_details_load" in context
            or "release_order_id" in context.lower()
        ):
            ro_numbers = set(re.findall(r"\d+", ro_no))
            for candidate in re.findall(r"\b\d{6,}\b", context):
                if candidate not in ro_numbers:
                    params["release_order_id_aso"] = candidate
                    break

        if not params.get("truckchit_number"):
            params["truckchit_number"] = truckchit_from_ro_no(ro_no)

        if params.get("release_order_id_aso"):
            actions[ro_no] = params

    return actions


def parse_html_tables(html: str):
    soup = BeautifulSoup(html, "html.parser")
    parsed_tables = []

    for table in soup.find_all("table"):
        rows = []
        row_actions = []
        for tr in table.find_all("tr"):
            if tr.find_parent("table") is not table:
                continue

            cells = []
            for cell in tr.find_all(["th", "td"], recursive=False):
                cell_soup = BeautifulSoup(str(cell), "html.parser")
                clean_cell = cell_soup.find(["th", "td"])
                if not clean_cell:
                    continue
                for nested_table in clean_cell.find_all("table"):
                    nested_table.decompose()
                cells.append(clean_cell.get_text(" ", strip=True))

            if cells and any(cells):
                rows.append(cells)
                action_params = {}
                for element in tr.find_all(["a", "button"]):
                    for attr in ("href", "onclick"):
                        action_params = extract_scm_detail_params(element.get(attr, ""))
                        if action_params:
                            break
                    if action_params:
                        break
                if not action_params:
                    action_params = extract_scm_detail_params(str(tr))
                row_actions.append(action_params)

        if not rows:
            continue

        max_cols = max(len(row) for row in rows)
        header_index = next((index for index, row in enumerate(rows) if len(row) == max_cols), 0)
        title_rows = rows[:header_index]
        headers = rows[header_index]
        data_rows = [row for row in rows[header_index + 1:] if len(row) > 1]
        data_actions = [
            row_actions[index]
            for index, row in enumerate(rows[header_index + 1:], start=header_index + 1)
            if len(row) > 1
        ]
        records = []
        if headers and data_rows:
            for index, row in enumerate(data_rows):
                if len(row) == len(headers):
                    record = dict(zip(headers, row))
                else:
                    record = {"cells": row}
                if index < len(data_actions) and data_actions[index]:
                    record["_action_params"] = data_actions[index]
                records.append(record)

        parsed_tables.append(
            {
                "title_rows": title_rows,
                "headers": headers,
                "rows": data_rows,
                "row_actions": data_actions,
                "records": records,
            }
        )

    return parsed_tables


STOCK_REGISTER_HEADERS = [
    "Sl.No",
    "Scheme",
    "Commodity",
    "Units",
    "Alloted Regular",
    "Alloted Extra",
    "OB Qty",
    "Received Regular",
    "Received Extra",
    "Received Moved",
    "Issued Qty",
    "CB Qty",
]


def parse_stock_register_tables(html: str):
    soup = BeautifulSoup(html, "html.parser")
    parsed_tables = []

    for table in soup.find_all("table"):
        extracted_rows = []
        for tr in table.find_all("tr"):
            if tr.find_parent("table") is not table:
                continue
            cells = [cell_text_without_nested(cell) for cell in tr.find_all(["th", "td"], recursive=False)]
            cells = [cell for cell in cells if cell != ""]
            if cells:
                extracted_rows.append(cells)

        data_rows = [
            normalize_report_row(row, len(STOCK_REGISTER_HEADERS))
            for row in extracted_rows
            if len(row) >= len(STOCK_REGISTER_HEADERS) and str(row[0]).strip().isdigit()
        ]
        if not data_rows:
            continue

        title_text = next(
            (
                " ".join(row)
                for row in extracted_rows
                if row and "Scheme Wise Stock Register" in " ".join(row)
            ),
            "",
        )
        records = [dict(zip(STOCK_REGISTER_HEADERS, row)) for row in data_rows]
        parsed_tables.append(
            {
                "title_rows": [[title_text]] if title_text else [],
                "headers": STOCK_REGISTER_HEADERS,
                "rows": data_rows,
                "records": records,
            }
        )

    return parsed_tables


def parse_fps_dealer_names(html: str):
    soup = BeautifulSoup(html, "html.parser")
    dealer_names = {}

    for row in soup.find_all("tr"):
        cells = [cell.get_text(" ", strip=True) for cell in row.find_all("td", recursive=False)]
        if len(cells) < 4:
            continue

        fps_id = re.sub(r"\D+", "", cells[1])
        dealer_name = cells[3].strip()
        if fps_id and dealer_name and dealer_name.upper() != "-NA-":
            dealer_names[fps_id] = dealer_name

    return dealer_names


def get_fps_dealer_name(dist_code: int, fps_id: int):
    cached = FPS_DEALER_CACHE.get(dist_code)
    if cached and time.time() - cached["stored_at"] <= FPS_DEALER_CACHE_TTL_SECONDS:
        return cached["dealer_names"].get(str(fps_id), "")

    response = EPOS_SESSION.post(
        "https://epos.kerala.gov.in/fps_device.action",
        data={"dist_code": dist_code},
        timeout=EPOS_TIMEOUT,
    )
    response.raise_for_status()
    dealer_names = parse_fps_dealer_names(response.text)
    FPS_DEALER_CACHE[dist_code] = {
        "stored_at": time.time(),
        "dealer_names": dealer_names,
    }
    return dealer_names.get(str(fps_id), "")


RO_QUANTITY_HEADERS = [
    ["District", "Taluk Name", "Dispatched Date", "Dispatch Time", "Truck NO", "TruckChit NO"],
    ["FP Shop Number", "Shop Name", "Shop Owner Name", "Shop Address", "No Of Bags", "Amount Paid"],
    [
        "Scheme",
        "Commodity",
        "Unit",
        "Allotment Qty",
        "Earlier Dispatched Qty",
        "Dispatched Qty",
        "Cost",
        "Balance Qty",
    ],
]


def cell_text_without_nested(cell):
    cell_soup = BeautifulSoup(str(cell), "html.parser")
    clean_cell = cell_soup.find(["th", "td"])
    if not clean_cell:
        return ""
    for nested in clean_cell.find_all(["table", "script", "style"]):
        nested.decompose()
    return clean_cell.get_text(" ", strip=True)


def row_matches_header(row, expected_headers):
    normalized_row = [normalize_header(value) for value in row]
    normalized_expected = [normalize_header(value) for value in expected_headers]
    return normalized_row[:len(normalized_expected)] == normalized_expected


def normalize_report_row(row, width):
    normalized = list(row[:width])
    if len(normalized) < width:
        normalized.extend([""] * (width - len(normalized)))
    return normalized


def strip_html_text(value: str):
    soup = BeautifulSoup(value or "", "html.parser")
    for nested in soup.find_all(["script", "style"]):
        nested.decompose()
    return soup.get_text(" ", strip=True)


def extract_cells_from_row_markup(row_html: str):
    cell_starts = list(re.finditer(r"<t[dh]\b[^>]*>", row_html, re.IGNORECASE))
    cells = []

    for index, match in enumerate(cell_starts):
        start = match.end()
        end_candidates = []
        next_cell_start = cell_starts[index + 1].start() if index + 1 < len(cell_starts) else None
        close_cell = re.search(r"</t[dh]\s*>", row_html[start:], re.IGNORECASE)
        close_row = re.search(r"</tr\s*>", row_html[start:], re.IGNORECASE)

        if next_cell_start is not None:
            end_candidates.append(next_cell_start)
        if close_cell:
            end_candidates.append(start + close_cell.start())
        if close_row:
            end_candidates.append(start + close_row.start())

        end = min(end_candidates) if end_candidates else len(row_html)
        text = strip_html_text(row_html[start:end])
        if text:
            cells.append(text)

    return cells


def extract_raw_report_rows(html: str):
    rows = []
    row_matches = list(re.finditer(r"<tr\b[^>]*>", html or "", re.IGNORECASE))

    for index, match in enumerate(row_matches):
        start = match.start()
        next_row_start = row_matches[index + 1].start() if index + 1 < len(row_matches) else len(html)
        close_row = re.search(r"</tr\s*>", html[match.end():next_row_start], re.IGNORECASE)
        end = match.end() + close_row.end() if close_row else next_row_start
        cells = extract_cells_from_row_markup(html[start:end])
        if cells:
            rows.append(cells)

    return rows


def parse_ro_quantity_report(html: str):
    raw_rows = extract_raw_report_rows(html)
    seen_consecutive = None
    deduped_rows = []

    for cells in raw_rows:
        if cells == seen_consecutive:
            continue
        seen_consecutive = cells
        deduped_rows.append(cells)

    raw_rows = deduped_rows

    tables = []
    current_table = None
    pending_title = []

    for row in raw_rows:
        first_cell = row[0] if row else ""
        if len(row) == 1 and "ro no" in first_cell.lower():
            pending_title = [row]
            continue

        matched_headers = next(
            (headers for headers in RO_QUANTITY_HEADERS if row_matches_header(row, headers)),
            None,
        )
        if matched_headers:
            current_table = {
                "title_rows": pending_title,
                "headers": matched_headers,
                "rows": [],
                "row_actions": [],
                "records": [],
            }
            pending_title = []
            tables.append(current_table)
            continue

        if not current_table:
            continue

        headers = current_table["headers"]
        if any(row_matches_header(row, known_headers) for known_headers in RO_QUANTITY_HEADERS):
            continue
        if len(row) < 2:
            continue

        data_row = normalize_report_row(row, len(headers))
        current_table["rows"].append(data_row)
        current_table["row_actions"].append({})
        current_table["records"].append(dict(zip(headers, data_row)))

    return [table for table in tables if table["headers"]]


def normalize_header(value: str):
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def get_row_value_by_header(headers, row, header_names):
    normalized_targets = {normalize_header(name) for name in header_names}
    for index, header in enumerate(headers or []):
        if normalize_header(header) in normalized_targets and index < len(row):
            return row[index]
    return ""


def normalize_ro_date(value: str):
    value = (value or "").strip()
    match = re.match(r"(\d{2})-(\d{2})-(\d{4})$", value)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month}-{day}"
    return value


def truckchit_from_ro_no(ro_no: str):
    if not ro_no:
        return ""
    parts = [part for part in ro_no.strip().split("/") if part]
    if len(parts) >= 7 and parts[0].upper() == "RO":
        return "TC-" + "-".join(parts[1:])
    return ""


def add_fallback_ro_actions(tables, request: RoDetailsRequest, html: str = ""):
    actions_by_ro_no = extract_scm_actions_by_ro_no(html)

    for table in tables:
        headers = table.get("headers") or []
        row_actions = table.get("row_actions") or []
        for index, row in enumerate(table.get("rows") or []):
            existing = row_actions[index] if index < len(row_actions) else {}

            ro_no = get_row_value_by_header(headers, row, ["RELEASE ORDER NO", "RO NO"])
            ro_date = get_row_value_by_header(headers, row, ["RO DATE", "DATE"])
            shop_number = get_row_value_by_header(headers, row, ["SHOP NO", "SHOP NUMBER"])
            if not ro_no:
                continue

            action = {
                "ro_no": ro_no,
                "month_int": str(request.month),
                "year_int": str(request.year),
                "ro_date": normalize_ro_date(ro_date),
                "shop_number": re.sub(r"\D+", "", shop_number) or str(request.shop_no),
                "district_code": str(request.dist_code),
                "truckchit_number": truckchit_from_ro_no(ro_no),
            }
            action.update(existing or {})
            action.update(actions_by_ro_no.get(ro_no, {}))
            action["ro_no"] = ro_no

            if not action.get("release_order_id_aso"):
                logger.warning("ro_details_action_missing_release_id ro_no=%s", ro_no)
                continue

            if index < len(row_actions):
                row_actions[index] = action
            else:
                row_actions.append(action)

            if index < len(table.get("records") or []):
                table["records"][index]["_action_params"] = action
        table["row_actions"] = row_actions

    return tables


TRANSACTION_HEADERS = [
    "sl_no",
    "rc_no",
    "scheme",
    "tagged_depot",
    "availed_depot",
    "receipt_no",
    "receipt_date",
    "time",
    "wheat",
    "atta",
    "rr",
    "br",
    "cmr",
    "sugar",
    "koil",
    "frr",
    "fbr",
    "fkoil",
    "pl_fbr",
    "free_kit",
    "free_kit_spl",
    "sub_kit",
    "amount",
    "trans_type",
    "auth_trans_time",
]


def parse_transaction_report(html: str):
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return {"title": "", "headers": TRANSACTION_HEADERS, "transactions": []}

    rows = table.find_all("tr")
    title = rows[0].get_text(" ", strip=True) if rows else ""
    width = len(TRANSACTION_HEADERS)
    data_cells = []

    for row in rows[3:]:
        cells = [cell.get_text(" ", strip=True) for cell in row.find_all("td")]
        if len(cells) >= width and len(cells) % width == 0:
            data_cells = cells
            break

    transactions = []
    for index in range(0, len(data_cells), width):
        chunk = data_cells[index:index + width]
        if len(chunk) == width:
            transactions.append(dict(zip(TRANSACTION_HEADERS, chunk)))

    return {"title": title, "headers": TRANSACTION_HEADERS, "transactions": transactions}


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def summarize_transactions(transactions):
    commodity_keys = [
        "wheat",
        "atta",
        "rr",
        "br",
        "cmr",
        "sugar",
        "koil",
        "frr",
        "fbr",
        "fkoil",
        "pl_fbr",
        "free_kit",
        "free_kit_spl",
        "sub_kit",
    ]
    commodity_totals = {
        key: round(sum(to_float(transaction.get(key)) for transaction in transactions), 3)
        for key in commodity_keys
    }
    return {
        "total_amount": round(sum(to_float(transaction.get("amount")) for transaction in transactions), 2),
        "transaction_count": len(transactions),
        "commodity_totals": commodity_totals,
    }


@app.get("/")
def serve_react_app():
    if REACT_INDEX_FILE.exists():
        return FileResponse(REACT_INDEX_FILE)
    raise HTTPException(status_code=404, detail="React build not found")


@app.get("/favicon.ico")
def favicon():
    return Response(status_code=204)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(int(time.time() * 1000))
    start_time = time.perf_counter()
    logger.info(
        "request_start request_id=%s method=%s path=%s client=%s",
        request_id,
        request.method,
        request.url.path,
        request.client.host if request.client else "unknown",
    )

    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "request_failed request_id=%s method=%s path=%s",
            request_id,
            request.method,
            request.url.path,
        )
        raise

    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
    logger.info(
        "request_end request_id=%s status_code=%s duration_ms=%s",
        request_id,
        response.status_code,
        duration_ms,
    )
    response.headers["X-Request-ID"] = request_id
    return response


@app.post("/fps-stock")
def get_fps_stock(request: StockRequest):
    url = "https://epos.kerala.gov.in/fps_stock.action"
    
    # The upstream endpoint likely expects form data or JSON. 
    # Based on standard practices for such .action endpoints (often Struts/Java), it's usually form-urlencoded.
    # However, I'll try sending it as data (form-urlencoded) first as it is safer for older frameworks.
    # If the user prompt implied JSON payload for *my* endpoint, I translate it.
    
    payload = {
        "fps_id": request.fps_id,
        "month": request.month,
        "year": request.year,
    }
    logger.info("fps_stock_start payload=%s", payload)
    
    try:
        # Using data=payload sends application/x-www-form-urlencoded
        response = requests.post(url, data=payload, timeout=30)
        logger.info(
            "fps_stock_upstream_response status_code=%s content_length=%s",
            response.status_code,
            len(response.text),
        )
        response.raise_for_status()
        
        # Parse the HTML response
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table', id='Report')
        if not table:
            logger.warning(
                "fps_stock_table_missing status_code=%s response_preview=%r",
                response.status_code,
                response.text[:500],
            )
            return {"remote_status_code": response.status_code, "content": response.text}
        
        header = table.find('th', colspan='11').text.strip()
        rows = table.find_all('tr')[2:]  # Skip header rows
        
        data = []
        for row in rows:
            cols = row.find_all('td')
            if len(cols) == 11:
                item = {
                    "sl_no": int(cols[0].text.strip()),
                    "commodity": cols[1].text.strip(),
                    "units": cols[2].text.strip(),
                    "alloted_regular": float(cols[3].text.strip()),
                    "alloted_extra": float(cols[4].text.strip()),
                    "ob_qty": float(cols[5].text.strip()),
                    "received_regular": float(cols[6].text.strip()),
                    "received_extra": float(cols[7].text.strip()),
                    "received_moved": float(cols[8].text.strip()),
                    "issued_qty": float(cols[9].text.strip()),
                    "cb_qty": float(cols[10].text.strip())
                }
                data.append(item)
        
        logger.info("fps_stock_success row_count=%s", len(data))
        return {"remote_status_code": response.status_code, "header": header, "data": data}
        

    except requests.RequestException as e:
        logger.exception("fps_stock_upstream_error payload=%s", payload)
        raise HTTPException(status_code=500, detail=f"Upstream ePoS request failed: {e}")
    except Exception as e:
        logger.exception("fps_stock_parse_error payload=%s", payload)
        raise HTTPException(status_code=500, detail=f"Backend parse error: {e}")


def fetch_transactions(request: TransactionsRequest):
    url = "https://epos.kerala.gov.in/day_wise_trans.action"
    payload = request.model_dump()
    cache_key = tuple(sorted(payload.items()))
    cached = TRANSACTIONS_CACHE.get(cache_key)
    if cached:
        age_seconds = time.time() - cached["stored_at"]
        if age_seconds <= TRANSACTIONS_CACHE_TTL_SECONDS:
            logger.info("transactions_cache_hit payload=%s age_seconds=%.2f", payload, age_seconds)
            return {
                **cached["data"],
                "cache_hit": True,
                "cache_age_seconds": round(age_seconds, 2),
            }

        TRANSACTIONS_CACHE.pop(cache_key, None)

    logger.info("transactions_start payload=%s", payload)

    try:
        start_time = time.perf_counter()
        response = EPOS_SESSION.post(url, data=payload, timeout=EPOS_TIMEOUT)
        upstream_duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(
            "transactions_upstream_response status_code=%s content_length=%s duration_ms=%s",
            response.status_code,
            len(response.text),
            upstream_duration_ms,
        )
        response.raise_for_status()

        parse_start_time = time.perf_counter()
        transaction_report = parse_transaction_report(response.text)
        transactions = transaction_report["transactions"]
        parse_duration_ms = round((time.perf_counter() - parse_start_time) * 1000, 2)
        total_duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        if not transactions:
            logger.warning(
                "transactions_missing status_code=%s response_preview=%r",
                response.status_code,
                response.text[:500],
            )
            result = {
                "remote_status_code": response.status_code,
                "cache_hit": False,
                "upstream_duration_ms": upstream_duration_ms,
                "parse_duration_ms": parse_duration_ms,
                "total_duration_ms": total_duration_ms,
                "title": transaction_report["title"],
                "summary": summarize_transactions([]),
                "transactions": [],
                "content_preview": response.text[:1000],
            }
            TRANSACTIONS_CACHE[cache_key] = {"stored_at": time.time(), "data": result}
            return result

        row_count = len(transactions)
        logger.info(
            "transactions_success row_count=%s upstream_ms=%s parse_ms=%s total_ms=%s",
            row_count,
            upstream_duration_ms,
            parse_duration_ms,
            total_duration_ms,
        )
        result = {
            "remote_status_code": response.status_code,
            "cache_hit": False,
            "upstream_duration_ms": upstream_duration_ms,
            "parse_duration_ms": parse_duration_ms,
            "total_duration_ms": total_duration_ms,
            "table_count": 1,
            "row_count": row_count,
            "title": transaction_report["title"],
            "summary": summarize_transactions(transactions),
            "headers": transaction_report["headers"],
            "transactions": transactions,
        }
        TRANSACTIONS_CACHE[cache_key] = {"stored_at": time.time(), "data": result}
        return result
    except requests.RequestException as e:
        logger.exception("transactions_upstream_error payload=%s", payload)
        raise HTTPException(status_code=500, detail=f"Upstream ePoS transaction request failed: {e}")
    except Exception as e:
        logger.exception("transactions_parse_error payload=%s", payload)
        raise HTTPException(status_code=500, detail=f"Backend transaction parse error: {e}")


@app.post("/transactions")
def get_transactions(request: TransactionsRequest):
    return fetch_transactions(request)


@app.post("/stock-register")
def get_stock_register(request: StockRegisterRequest):
    fps_id = str(request.fps_id)
    if len(fps_id) != 7 or not fps_id.isdigit():
        raise HTTPException(status_code=400, detail="FPS ID must contain exactly 7 digits")

    fps_district_code = int(fps_id[:2])
    fps_office_code = int(fps_id[2:4])
    if request.dist_code != fps_district_code or request.office_code != fps_office_code:
        raise HTTPException(
            status_code=400,
            detail=(
                f"FPS ID {fps_id} belongs to district code {fps_district_code} "
                f"and office code {fps_office_code}, not district code {request.dist_code} "
                f"and office code {request.office_code}"
            ),
        )

    url = "https://epos.kerala.gov.in/fps_stock_register.action"
    payload = request.model_dump()
    start_time = time.perf_counter()
    logger.info("stock_register_start payload=%s", payload)
    try:
        response = EPOS_SESSION.post(url, data=payload, timeout=EPOS_TIMEOUT)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(
            "stock_register_upstream_response status_code=%s content_length=%s duration_ms=%s",
            response.status_code,
            len(response.text),
            duration_ms,
        )
        response.raise_for_status()
        tables = parse_stock_register_tables(response.text)
        licensee_name = ""
        try:
            licensee_name = get_fps_dealer_name(request.dist_code, request.fps_id)
        except Exception:
            logger.warning(
                "fps_dealer_lookup_failed dist_code=%s fps_id=%s",
                request.dist_code,
                request.fps_id,
                exc_info=True,
            )
        return {
            "remote_status_code": response.status_code,
            "duration_ms": duration_ms,
            "table_count": len(tables),
            "tables": tables,
            "licensee_name": licensee_name,
            "response_preview": response.text[:800] if not tables else "",
        }
    except requests.RequestException as e:
        logger.exception("stock_register_upstream_error payload=%s", payload)
        raise HTTPException(status_code=500, detail=f"Upstream ePoS stock register request failed: {e}")
    except Exception as e:
        logger.exception("stock_register_parse_error payload=%s", payload)
        raise HTTPException(status_code=500, detail=f"Backend stock register parse error: {e}")


@app.post("/ro-details")
def get_ro_details(request: RoDetailsRequest):
    url = "https://scm.kerala.gov.in/List_of_ro_details.jsp"
    params = {
        "month": request.month,
        "year": request.year,
        "shop_no": request.shop_no,
        "dist_code": request.dist_code,
        "depot_id": request.depot_id,
    }
    start_time = time.perf_counter()
    logger.info("ro_details_start payload=%s", params)
    try:
        response = EPOS_SESSION.get(url, params=params, timeout=EPOS_TIMEOUT)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(
            "ro_details_upstream_response status_code=%s content_length=%s duration_ms=%s",
            response.status_code,
            len(response.text),
            duration_ms,
        )
        response.raise_for_status()
        tables = parse_html_tables(response.text)
        tables = add_fallback_ro_actions(tables, request, response.text)
        return {
            "remote_status_code": response.status_code,
            "duration_ms": duration_ms,
            "table_count": len(tables),
            "tables": tables,
            "response_preview": response.text[:500] if not tables else "",
        }
    except requests.RequestException as e:
        logger.exception("ro_details_upstream_error payload=%s", params)
        raise HTTPException(status_code=500, detail=f"Upstream SCM request failed: {e}")
    except Exception as e:
        logger.exception("ro_details_parse_error payload=%s", params)
        raise HTTPException(status_code=500, detail=f"Backend parse error: {e}")


@app.post("/ro-quantity-details")
def get_ro_quantity_details(request: RoQuantityDetailsRequest):
    if not request.ro_no:
        raise HTTPException(status_code=400, detail="RO number is required to load quantity details")
    if not request.release_order_id_aso:
        raise HTTPException(
            status_code=400,
            detail="SCM did not provide the release order id for this row. Refresh RO Details and try again.",
        )

    ro_parts = [part for part in request.ro_no.strip().split("/") if part]
    month_int = request.month_int
    year_int = request.year_int
    shop_number = request.shop_number
    district_code = request.district_code
    if len(ro_parts) >= 7:
        district_code = district_code or int(ro_parts[2]) if ro_parts[2].isdigit() else district_code
        shop_number = shop_number or int(ro_parts[3]) if ro_parts[3].isdigit() else shop_number
        month_int = month_int or int(ro_parts[4]) if ro_parts[4].isdigit() else month_int
        year_int = year_int or int(ro_parts[5]) if ro_parts[5].isdigit() else year_int

    url = "https://scm.kerala.gov.in/ro_quantity_details_load.jsp"
    params = {
        "release_order_id_aso": request.release_order_id_aso,
        "ro_no": request.ro_no,
        "month_int": month_int,
        "year_int": year_int,
        "ro_date": request.ro_date,
        "shop_number": shop_number,
        "district_code": district_code,
        "truckchit_number": request.truckchit_number or truckchit_from_ro_no(request.ro_no),
    }
    params = {key: value for key, value in params.items() if value not in ("", None)}
    start_time = time.perf_counter()
    logger.info("ro_quantity_details_start payload=%s", params)
    try:
        response = EPOS_SESSION.get(url, params=params, timeout=EPOS_TIMEOUT)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.info(
            "ro_quantity_details_upstream_response status_code=%s content_length=%s duration_ms=%s",
            response.status_code,
            len(response.text),
            duration_ms,
        )
        response.raise_for_status()
        tables = parse_ro_quantity_report(response.text)
        if not any(table.get("rows") for table in tables):
            tables = parse_html_tables(response.text)
        has_rows = any(table.get("rows") for table in tables)
        return {
            "remote_status_code": response.status_code,
            "duration_ms": duration_ms,
            "table_count": len(tables),
            "tables": tables,
            "response_preview": response.text[:1200] if not has_rows else "",
        }
    except requests.RequestException as e:
        logger.exception("ro_quantity_details_upstream_error payload=%s", params)
        raise HTTPException(status_code=500, detail=f"Upstream SCM quantity request failed: {e}")
    except Exception as e:
        logger.exception("ro_quantity_details_parse_error payload=%s", params)
        raise HTTPException(status_code=500, detail=f"Backend parse error: {e}")



# Updated /count endpoint to sum CB Qty for RAW RICE group
@app.post("/count")
def get_raw_rice_cb_sum(request: StockRequest):
    url = "https://epos.kerala.gov.in/fps_stock.action"
    payload = {
        "fps_id": request.fps_id,
        "month": request.month,
        "year": request.year,
    }
    logger.info("count_start payload=%s", payload)
    try:
        response = requests.post(url, data=payload, timeout=30)
        logger.info(
            "count_upstream_response status_code=%s content_length=%s",
            response.status_code,
            len(response.text),
        )
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        table = soup.find('table', id='Report')
        if not table:
            logger.warning(
                "count_table_missing status_code=%s response_preview=%r",
                response.status_code,
                response.text[:500],
            )
            return {"remote_status_code": response.status_code, "RAW_RICE_cb_sum": 0}
        rows = table.find_all('tr')[2:]  # Skip header rows
        raw_cb_sum = 0
        br_cb_sum = 0
        matta_cmr_cb_sum = 0
        wheat_cb_sum = 0
        sugar_cb_sum = 0
        atta_cb_sum = 0
        koil_cb_sum = 0
        for row in rows:
            cols = row.find_all('td')
            if len(cols) == 11:
                commodity = cols[1].text.strip()
                comm_lower = commodity.lower()
                # RAW RICE group
                if ("raw" in comm_lower) or ("rr" in comm_lower):
                    try:
                        raw_cb_sum += float(cols[10].text.strip())
                    except ValueError:
                        pass
                # BOILED RICE group
                if ("boiled" in comm_lower) or ("br" in comm_lower):
                    try:
                        br_cb_sum += float(cols[10].text.strip())
                    except ValueError:
                        pass
                # Matta or CMR group (combined)
                if ("cmr" in comm_lower) or ("matta" in comm_lower):
                    try:
                        matta_cmr_cb_sum += float(cols[10].text.strip())
                    except ValueError:
                        pass
                # Wheat group
                if "wheat" in comm_lower:
                    try:
                        wheat_cb_sum += float(cols[10].text.strip())
                    except ValueError:
                        pass
                # Sugar group
                if "sugar" in comm_lower:
                    try:
                        sugar_cb_sum += float(cols[10].text.strip())
                    except ValueError:
                        pass
                # Atta group
                if re.search(r"\batta\b", comm_lower):
                    try:
                        atta_cb_sum += float(cols[10].text.strip())
                    except ValueError:
                        pass
                # Koil group (liters, no bag count)
                if "koil" in comm_lower:
                    try:
                        koil_cb_sum += float(cols[10].text.strip())
                    except ValueError:
                        pass
        rice_bag_weight = request.rice_bag_weight
        wheat_bag_weight = request.wheat_bag_weight
        sugar_bag_weight = request.sugar_bag_weight
        atta_bag_weight = request.atta_bag_weight
        # RAW RICE bags
        raw_bag_count = int(raw_cb_sum // rice_bag_weight)
        raw_remaining_kg = raw_cb_sum % rice_bag_weight
        # BOILED RICE bags
        br_bag_count = int(br_cb_sum // rice_bag_weight)
        br_remaining_kg = br_cb_sum % rice_bag_weight
        # Matta/CMR bags (combined)
        matta_cmr_bag_count = int(matta_cmr_cb_sum // rice_bag_weight)
        matta_cmr_remaining_kg = matta_cmr_cb_sum % rice_bag_weight
        # Wheat bags
        wheat_bag_count = int(wheat_cb_sum // wheat_bag_weight)
        wheat_remaining_kg = wheat_cb_sum % wheat_bag_weight
        # Sugar bags
        sugar_bag_count = int(sugar_cb_sum // sugar_bag_weight)
        sugar_remaining_kg = sugar_cb_sum % sugar_bag_weight
        # Atta bags
        atta_bag_count = int(atta_cb_sum // atta_bag_weight)
        atta_remaining_kg = atta_cb_sum % atta_bag_weight
        result = {
            "bag_weights": {
                "rice": f"{rice_bag_weight} kg",
                "wheat": f"{wheat_bag_weight} kg",
                "sugar": f"{sugar_bag_weight} kg",
                "atta": f"{atta_bag_weight} kg",
            },
            "RAW_RICE_cb_sum": f"{raw_cb_sum} kg",
            "RAW_RICE_bag_count": raw_bag_count,
            "RAW_RICE_remaining_kg": f"{raw_remaining_kg} kg",
            "BOILED_RICE_cb_sum": f"{br_cb_sum} kg",
            "BOILED_RICE_bag_count": br_bag_count,
            "BOILED_RICE_remaining_kg": f"{br_remaining_kg} kg",
            "MATTA_CMR_cb_sum": f"{matta_cmr_cb_sum} kg",
            "MATTA_CMR_bag_count": matta_cmr_bag_count,
            "MATTA_CMR_remaining_kg": f"{matta_cmr_remaining_kg} kg",
            "WHEAT_cb_sum": f"{wheat_cb_sum} kg",
            "WHEAT_bag_count": wheat_bag_count,
            "WHEAT_remaining_kg": f"{wheat_remaining_kg} kg",
            "SUGAR_cb_sum": f"{sugar_cb_sum} kg",
            "SUGAR_bag_count": sugar_bag_count,
            "SUGAR_remaining_kg": f"{sugar_remaining_kg} kg",
            "ATTA_cb_sum": f"{atta_cb_sum} kg",
            "ATTA_bag_count": atta_bag_count,
            "ATTA_remaining_kg": f"{atta_remaining_kg} kg",
            "KOIL_cb_sum": f"{koil_cb_sum} ltr",
            "KOIL_remaining_ltr": f"{koil_cb_sum} ltr"
        }
        logger.info(
            "count_success rows=%s raw=%s boiled=%s matta_cmr=%s wheat=%s sugar=%s atta=%s koil=%s",
            len(rows),
            raw_cb_sum,
            br_cb_sum,
            matta_cmr_cb_sum,
            wheat_cb_sum,
            sugar_cb_sum,
            atta_cb_sum,
            koil_cb_sum,
        )
        return result
    except requests.RequestException as e:
        logger.exception("count_upstream_error payload=%s", payload)
        raise HTTPException(status_code=500, detail=f"Upstream ePoS request failed: {e}")
    except Exception as e:
        logger.exception("count_parse_error payload=%s", payload)
        raise HTTPException(status_code=500, detail=f"Backend parse error: {e}")
