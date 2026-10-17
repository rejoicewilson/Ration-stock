import { accountRequest } from './accountApi';

const CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_URL;
    script.async = true;
    let timer;
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      scriptPromise = undefined;
      reject(new Error('Could not load payment checkout. Please try again.'));
    };
    script.onload = () => {
      window.clearTimeout(timer);
      if (window.Razorpay) resolve(window.Razorpay);
      else fail();
    };
    script.onerror = fail;
    timer = window.setTimeout(fail, 15000);
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function reconcilePayment() {
  return accountRequest('subscription/reconcile', {});
}

export async function openSubscriptionCheckout({ onOrder = () => {}, onVerifying = () => {} } = {}) {
  const Razorpay = await loadRazorpay();
  const order = await accountRequest('subscription/order', {});
  if (order.already_active && order.subscription?.access_allowed) return { state: 'active' };
  if (order.amount !== 9900 || order.currency !== 'INR'
      || !/^order_[A-Za-z0-9]+$/.test(order.order_id)
      || !['test', 'live'].includes(order.mode)
      || !order.key_id?.startsWith(`rzp_${order.mode}_`)) throw new Error('Could not prepare payment.');
  onOrder(order);
  return new Promise((resolve, reject) => {
    let finishing = false;
    const recover = async () => {
      try {
        const result = await reconcilePayment();
        return result.subscription?.paid_active ? { state: 'active' } : { state: 'pending' };
      } catch {
        return { state: 'pending' };
      }
    };
    const checkout = new Razorpay({
      key: order.key_id, order_id: order.order_id, amount: order.amount, currency: order.currency,
      name: 'Ration Stock App', description: order.mode === 'test' ? 'TEST — ₹99 / 30 days, no real money' : '₹99 / 30 days',
      prefill: { contact: order.prefill_contact }, theme: { color: '#304fbb' },
      retry: { enabled: true },
      handler: async result => {
        if (finishing) return;
        finishing = true;
        onVerifying();
        try {
          const verified = await accountRequest('subscription/verify', {
            razorpay_order_id: result.razorpay_order_id,
            razorpay_payment_id: result.razorpay_payment_id,
            razorpay_signature: result.razorpay_signature,
          });
          resolve(verified.activated && verified.subscription?.paid_active ? { state: 'active' } : { state: 'pending' });
        } catch {
          resolve(await recover());
        }
      },
      modal: { ondismiss: async () => {
        if (finishing) return;
        finishing = true;
        onVerifying();
        // Closing checkout cannot prove that a bank payment failed.
        resolve(await recover());
      } },
    });
    try { checkout.open(); } catch (error) { reject(error); }
  });
}
