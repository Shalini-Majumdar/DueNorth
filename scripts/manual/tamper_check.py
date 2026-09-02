"""Manual check: a tampered signature must be rejected with HTTP 400.

Requires the webhook server running locally:
    uvicorn api.webhook:app --port 8000
"""

import httpx

body = b'{"event": "payment_link.paid"}'
r = httpx.post(
    "http://localhost:8000/webhook",
    content=body,
    headers={
        "Content-Type": "application/json",
        "x-razorpay-signature": "invalidsignature",
        "x-razorpay-event-id": "evt_tampered_001",
    },
)
print("Status:", r.status_code)
print("Correctly rejected:", r.status_code == 400)
