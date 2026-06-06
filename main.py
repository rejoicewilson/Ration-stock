import logging
import re
import time
from logging.handlers import RotatingFileHandler

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup

app = FastAPI()

logger = logging.getLogger("ration-backend")
logger.setLevel(logging.INFO)

log_formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
file_handler = RotatingFileHandler(
    "backend.log",
    maxBytes=1_000_000,
    backupCount=3,
    encoding="utf-8",
)
file_handler.setFormatter(log_formatter)
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

if not logger.handlers:
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

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
    
    payload = request.model_dump()
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



# Updated /count endpoint to sum CB Qty for RAW RICE group
@app.post("/count")
def get_raw_rice_cb_sum(request: StockRequest):
    url = "https://epos.kerala.gov.in/fps_stock.action"
    payload = request.model_dump()
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
        # RAW RICE bags
        raw_bag_count = int(raw_cb_sum // 50)
        raw_remaining_kg = raw_cb_sum % 50
        # BOILED RICE bags
        br_bag_count = int(br_cb_sum // 50)
        br_remaining_kg = br_cb_sum % 50
        # Matta/CMR bags (combined)
        matta_cmr_bag_count = int(matta_cmr_cb_sum // 50)
        matta_cmr_remaining_kg = matta_cmr_cb_sum % 50
        # Wheat bags
        wheat_bag_count = int(wheat_cb_sum // 50)
        wheat_remaining_kg = wheat_cb_sum % 50
        # Sugar bags
        sugar_bag_count = int(sugar_cb_sum // 50)
        sugar_remaining_kg = sugar_cb_sum % 50
        # Atta bags
        atta_bag_count = int(atta_cb_sum // 50)
        atta_remaining_kg = atta_cb_sum % 50
        result = {
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
