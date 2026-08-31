"""Udyam registration validation and flow assignment.

First gate in the DueNorth pipeline. Nothing downstream runs until onboard()
succeeds. Pure function: validates the supplier's Udyam Registration Number
(URN) and assigns a processing flow.
"""

import re

# UDYAM-[2 uppercase letters]-[2 digits]-[7 digits]
URN_PATTERN = re.compile(r"^UDYAM-[A-Z]{2}-\d{2}-\d{7}$")

STATUTORY_STATUSES = {"Micro", "Small"}
REMINDER_ONLY_STATUSES = {"Medium", "not_registered"}

_INVALID_URN_MESSAGE = (
    "Invalid Udyam Registration Number for a Micro/Small supplier. "
    "Statutory interest and MSEFC escalation require a valid URN in format "
    "UDYAM-XX-00-0000000."
)


def is_valid_urn(urn: str) -> bool:
    """Return True if urn matches the exact Udyam format (after stripping)."""
    if not isinstance(urn, str):
        return False
    return URN_PATTERN.match(urn.strip()) is not None


def onboard(supplier: dict) -> dict:
    """Validate a supplier's Udyam registration and assign a flow.

    Input: supplier dict with keys
      udyam_status: "Micro" | "Small" | "Medium" | "not_registered"
      udyam_number: URN string (may be missing/empty for Medium/not_registered)

    Output: a copy of the dict with two keys added
      statutory_eligible: bool
      flow: "full" | "reminders_only"

    Raises ValueError if a Micro/Small supplier has a missing/malformed URN.
    """
    result = dict(supplier)
    status = result.get("udyam_status")

    if status in REMINDER_ONLY_STATUSES:
        result["statutory_eligible"] = False
        result["flow"] = "reminders_only"
        return result

    if status in STATUTORY_STATUSES:
        raw = result.get("udyam_number")
        if not is_valid_urn(raw):
            raise ValueError(_INVALID_URN_MESSAGE)
        result["udyam_number"] = raw.strip()
        result["statutory_eligible"] = True
        result["flow"] = "full"
        return result

    raise ValueError(
        f"Unknown udyam_status {status!r}; expected one of "
        "'Micro', 'Small', 'Medium', 'not_registered'."
    )
