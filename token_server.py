import asyncio
import os
import uuid
import json
from aiohttp import web
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants, LiveKitAPI, CreateAgentDispatchRequest

from app.settings import get_all_settings, set_setting, verify_admin_pin
from app.memory.service import (
    get_all_appointments,
    get_appointment_by_id,
    save_appointment,
    update_appointment_full,
    delete_appointment,
    get_doctors,
    create_customer,
)

load_dotenv(".env")

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://ai-voice-1k1vmmvd.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }


def json_response(data, status=200, headers=None):
    h = cors_headers()
    if headers:
        h.update(headers)
    return web.json_response(data, status=status, headers=h, dumps=lambda o: json.dumps(o, default=str))


async def options_handler(request: web.Request):
    return web.Response(headers=cors_headers())


async def get_token(request: web.Request):
    room = request.query.get("room", "receptionist-room")
    name = request.query.get("name", "Patient")
    identity = f"{name.lower().replace(' ', '_')}-{uuid.uuid4().hex[:6]}"

    token = AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    token.with_identity(identity)
    token.with_name(name)
    token.with_grants(
        VideoGrants(
            room_join=True,
            room=room,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        )
    )

    jwt = token.to_jwt()

    # Automatically dispatch agent to the room
    try:
        lk = LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        await lk.agent_dispatch.create_dispatch(
            CreateAgentDispatchRequest(
                agent_name="my-agent",
                room=room,
            )
        )
        await lk.aclose()
    except Exception as e:
        print("Dispatch note:", e)

    return json_response({
        "success": True,
        "token": jwt,
        "url": LIVEKIT_URL,
        "room": room,
        "identity": identity,
        "name": name,
    }, headers=cors_headers())


async def get_settings_handler(request: web.Request):
    settings = get_all_settings()
    return json_response({
        "success": True,
        "settings": settings,
    }, headers=cors_headers())


async def post_settings_handler(request: web.Request):
    try:
        data = await request.json()
        for k, v in data.items():
            set_setting(k, v)
        updated = get_all_settings()
        return json_response({
            "success": True,
            "message": "Settings updated successfully.",
            "settings": updated,
        }, headers=cors_headers())
    except Exception as e:
        return json_response({"success": False, "error": str(e)}, status=400, headers=cors_headers())


async def verify_pin_handler(request: web.Request):
    try:
        data = await request.json()
        pin = data.get("pin", "")
        valid = verify_admin_pin(pin)
        if valid:
            return json_response({
                "success": True,
                "authenticated": True,
                "message": "PIN verified successfully.",
            }, headers=cors_headers())
        else:
            return json_response({
                "success": False,
                "authenticated": False,
                "message": "Invalid administrator PIN.",
            }, status=401, headers=cors_headers())
    except Exception as e:
        return json_response({"success": False, "error": str(e)}, status=400, headers=cors_headers())


async def get_doctors_handler(request: web.Request):
    docs = await get_doctors()
    return json_response({
        "success": True,
        "count": len(docs),
        "doctors": [dict(d) for d in docs],
    }, headers=cors_headers())


async def get_appointments_handler(request: web.Request):
    doctor_id = request.query.get("doctor_id")
    status = request.query.get("status")
    date_str = request.query.get("date")
    search = request.query.get("search")

    appts = await get_all_appointments(doctor_id=doctor_id, status=status, date_str=date_str, search=search)
    return json_response({
        "success": True,
        "count": len(appts),
        "appointments": appts,
    }, headers=cors_headers())


async def post_appointments_handler(request: web.Request):
    try:
        data = await request.json()
        patient_name = data.get("patient_name")
        patient_phone = data.get("patient_phone")
        doctor_id = data.get("doctor_id")
        start_time = data.get("start_time")
        duration_minutes = int(data.get("duration_minutes", 30))
        reason = data.get("reason", "Consultation")
        notes = data.get("notes", "")
        status = data.get("status", "scheduled")

        customer = await create_customer(name=patient_name, phone=patient_phone)
        
        from datetime import datetime, timedelta
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("Asia/Kolkata")
        start_dt = datetime.fromisoformat(start_time)
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=tz)
        end_dt = start_dt + timedelta(minutes=duration_minutes)

        created = await save_appointment(
            customer_id=customer["id"],
            calendar_event_id=None,
            start_time=start_dt,
            end_time=end_dt,
            reason=reason,
            status=status,
            doctor_id=doctor_id,
            notes=notes,
        )

        return json_response({
            "success": True,
            "appointment": created,
        }, status=201, headers=cors_headers())
    except Exception as e:
        return json_response({"success": False, "error": str(e)}, status=400, headers=cors_headers())


async def appointment_detail_handler(request: web.Request):
    appt_id = request.match_info.get("id")
    if request.method == "GET":
        appt = await get_appointment_by_id(appt_id)
        if not appt:
            return json_response({"success": False, "error": "Not found"}, status=404, headers=cors_headers())
        return json_response({"success": True, "appointment": appt}, headers=cors_headers())

    if request.method in ("PUT", "PATCH"):
        data = await request.json()
        updated = await update_appointment_full(
            appointment_id=appt_id,
            status=data.get("status"),
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            doctor_id=data.get("doctor_id"),
            reason=data.get("reason"),
            notes=data.get("notes"),
            google_synced=data.get("google_synced"),
        )
        return json_response({"success": True, "appointment": updated}, headers=cors_headers())

    if request.method == "DELETE":
        await delete_appointment(appt_id)
        return json_response({"success": True, "message": "Deleted"}, headers=cors_headers())


async def get_stats_handler(request: web.Request):
    from datetime import datetime
    today_str = datetime.now().strftime("%Y-%m-%d")
    all_appts = await get_all_appointments()
    total = len(all_appts)
    today_cnt = sum(1 for a in all_appts if str(a.get("start_time", "")).startswith(today_str) and a.get("status") != "cancelled")
    scheduled_cnt = sum(1 for a in all_appts if a.get("status") == "scheduled")
    confirmed_cnt = sum(1 for a in all_appts if a.get("status") == "confirmed")
    completed_cnt = sum(1 for a in all_appts if a.get("status") == "completed")
    cancelled_cnt = sum(1 for a in all_appts if a.get("status") == "cancelled")

    docs = await get_doctors()
    settings = get_all_settings()

    return json_response({
        "success": True,
        "stats": {
            "total": total,
            "today": today_cnt,
            "scheduled": scheduled_cnt,
            "confirmed": confirmed_cnt,
            "completed": completed_cnt,
            "cancelled": cancelled_cnt,
            "doctors_count": len(docs),
            "google_calendar_enabled": bool(settings.get("google_calendar_enabled")),
        }
    }, headers=cors_headers())


def create_app():
    app = web.Application()
    app.router.add_get("/api/token", get_token)
    app.router.add_options("/api/token", options_handler)

    app.router.add_get("/api/settings", get_settings_handler)
    app.router.add_post("/api/settings", post_settings_handler)
    app.router.add_options("/api/settings", options_handler)

    app.router.add_post("/api/admin/verify-pin", verify_pin_handler)
    app.router.add_options("/api/admin/verify-pin", options_handler)

    app.router.add_get("/api/doctors", get_doctors_handler)
    app.router.add_options("/api/doctors", options_handler)

    app.router.add_get("/api/stats", get_stats_handler)
    app.router.add_options("/api/stats", options_handler)

    app.router.add_get("/api/appointments", get_appointments_handler)
    app.router.add_post("/api/appointments", post_appointments_handler)
    app.router.add_options("/api/appointments", options_handler)

    app.router.add_get("/api/appointments/{id}", appointment_detail_handler)
    app.router.add_put("/api/appointments/{id}", appointment_detail_handler)
    app.router.add_patch("/api/appointments/{id}", appointment_detail_handler)
    app.router.add_delete("/api/appointments/{id}", appointment_detail_handler)
    app.router.add_options("/api/appointments/{id}", options_handler)

    return app


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8080"))
    app = create_app()
    print(f"ABC Health Care Clinical API running on http://0.0.0.0:{port}")
    web.run_app(app, host="0.0.0.0", port=port)
