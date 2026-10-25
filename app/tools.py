import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from livekit.agents import function_tool, RunContext

from app.settings import is_google_calendar_enabled
from app.google_calendar import (
    is_available as google_is_available,
    create_event as google_create_event,
    delete_event as google_delete_event,
    update_event as google_update_event,
)
from app.memory.service import (
    create_customer,
    save_appointment,
    update_appointment_status,
    update_appointment_time,
    save_memory,
    get_doctors as fetch_doctors,
    get_doctor_by_id,
    find_doctor,
    get_default_doctor,
    check_local_availability,
    get_local_available_slots,
)

logger = logging.getLogger("ai-receptionist.tools")


async def broadcast_tool_status(
    context: RunContext,
    tool_name: str,
    message: str,
    status: str = "running",
):
    """Publish live tool calling progress to the client WebRTC room."""
    try:
        session = getattr(context, "session", None)
        if session:
            room = getattr(session, "room", None)
            if room and room.isconnected():
                payload = json.dumps({
                    "type": "tool_call",
                    "status": status,
                    "tool": tool_name,
                    "message": message,
                    "timestamp": time.time(),
                }).encode("utf-8")
                await room.local_participant.publish_data(payload, reliable=True, topic="status")
    except Exception as e:
        logger.debug("broadcast_tool_status note: %s", e)


class AppointmentTools:

    @function_tool
    async def get_current_datetime(
        self,
        context: RunContext,
    ) -> dict:
        """Get the current date and time in India for ABC Health Care clinic scheduling."""
        await broadcast_tool_status(context, "get_current_datetime", "Checking current clinic date and time...", "running")
        now = datetime.now(ZoneInfo("Asia/Kolkata"))

        return {
            "date": now.strftime("%Y-%m-%d"),
            "time": now.strftime("%I:%M %p"),
            "datetime": now.isoformat(),
            "timezone": "Asia/Kolkata",
            "day": now.strftime("%A"),
        }

    @function_tool
    async def get_doctors(
        self,
        context: RunContext,
        query: str = "",
    ) -> dict:
        """Get the list of doctors and their specializations at ABC Health Care. Can optionally search by specialization (e.g., 'Cardiology', 'Dermatology', 'General Physician') or doctor name."""
        search_desc = f" for '{query}'" if query else ""
        await broadcast_tool_status(context, "get_doctors", f"Searching medical specialists directory{search_desc}...", "running")
        try:
            if query and query.strip():
                docs = await find_doctor(query.strip())
            else:
                docs = await fetch_doctors()
            await broadcast_tool_status(context, "get_doctors", f"Found {len(docs)} medical specialists.", "completed")

            results = [
                {
                    "doctor_id": str(d["id"]),
                    "name": d["name"],
                    "specialization": d["specialization"],
                    "degrees": d.get("degrees", ""),
                    "room": d.get("room", ""),
                }
                for d in docs
            ]

            return {
                "success": True,
                "count": len(results),
                "doctors": results,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "doctors": [],
            }

    @function_tool
    async def check_availability(
        self,
        context: RunContext,
        start_time: str,
        duration_minutes: int = 30,
        doctor_id: str = "",
    ) -> dict:
        """Check whether a specific appointment time is available at ABC Health Care clinic."""
        await broadcast_tool_status(context, "check_availability", f"Checking availability for {start_time}...", "running")
        try:
            tz = ZoneInfo("Asia/Kolkata")
            start = datetime.fromisoformat(start_time)
            if start.tzinfo is None:
                start = start.replace(tzinfo=tz)

            end = start + timedelta(minutes=duration_minutes)

            # 1. Always check local clinic appointment database
            local_free = await check_local_availability(start, end, doctor_id=doctor_id)
            if not local_free:
                await broadcast_tool_status(context, "check_availability", "Slot is already booked in clinic calendar.", "completed")
                return {
                    "success": True,
                    "available": False,
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "source": "local_database",
                }

            # 2. If Google Calendar sync is turned ON, also check Google Calendar
            if is_google_calendar_enabled():
                google_free = await asyncio.to_thread(google_is_available, start, end)
                if not google_free:
                    await broadcast_tool_status(context, "check_availability", "Slot unavailable on Google Calendar.", "completed")
                    return {
                        "success": True,
                        "available": False,
                        "start": start.isoformat(),
                        "end": end.isoformat(),
                        "source": "google_calendar",
                    }

            await broadcast_tool_status(context, "check_availability", "Time slot is available!", "completed")
            return {
                "success": True,
                "available": True,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "source": "google_and_local" if is_google_calendar_enabled() else "local_database",
            }

        except Exception as e:
            await broadcast_tool_status(context, "check_availability", f"Error checking availability: {e}", "error")
            return {
                "success": False,
                "error": str(e),
            }

    @function_tool
    async def get_available_slots(
        self,
        context: RunContext,
        date: str,
        duration_minutes: int = 30,
        doctor_id: str = "",
    ) -> dict:
        """Get available appointment slots for a specific date at ABC Health Care clinic."""
        await broadcast_tool_status(context, "get_available_slots", f"Querying appointment slots for {date}...", "running")
        try:
            slots = await get_local_available_slots(
                date_str=date,
                duration_minutes=duration_minutes,
                doctor_id=doctor_id if doctor_id else None,
            )
            await broadcast_tool_status(context, "get_available_slots", f"Found {len(slots)} open slots for {date}.", "completed")

            return {
                "success": True,
                "date": date,
                "slots": slots,
                "count": len(slots),
                "mode": "google_and_local" if is_google_calendar_enabled() else "local_database",
            }

        except Exception as e:
            await broadcast_tool_status(context, "get_available_slots", f"Error querying slots: {e}", "error")
            return {
                "success": False,
                "error": str(e),
            }

    @function_tool
    async def book_appointment(
        self,
        context: RunContext,
        customer_name: str,
        customer_phno: str,
        start_time: str,
        duration_minutes: int = 30,
        reason: str = "",
        doctor_id: str = "",
    ) -> dict:
        """Book a clinic appointment for a patient at ABC Health Care after the patient confirms the time and doctor, and save to database (and Google Calendar if enabled)."""
        await broadcast_tool_status(context, "book_appointment", f"Booking appointment for {customer_name}...", "running")
        try:
            tz = ZoneInfo("Asia/Kolkata")
            start = datetime.fromisoformat(start_time)
            if start.tzinfo is None:
                start = start.replace(tzinfo=tz)

            end = start + timedelta(minutes=duration_minutes)

            # Resolve doctor first
            doctor_record = None
            if doctor_id and doctor_id.strip():
                doctor_record = await get_doctor_by_id(doctor_id.strip())
                if not doctor_record:
                    matched = await find_doctor(doctor_id.strip())
                    if matched:
                        doctor_record = matched[0]

            if not doctor_record and reason:
                matched = await find_doctor(reason)
                if matched:
                    doctor_record = matched[0]

            if not doctor_record:
                doctor_record = await get_default_doctor()

            assigned_doctor_id = str(doctor_record["id"]) if doctor_record else None
            doctor_name = doctor_record["name"] if doctor_record else "General Physician"
            doctor_spec = doctor_record["specialization"] if doctor_record else "General Medicine"

            # Always check availability before booking
            local_free = await check_local_availability(start, end, doctor_id=assigned_doctor_id)
            if not local_free:
                return {
                    "success": False,
                    "error": "This time slot is no longer available.",
                }

            if is_google_calendar_enabled():
                google_free = await asyncio.to_thread(google_is_available, start, end)
                if not google_free:
                    return {
                        "success": False,
                        "error": "This time slot is taken on Google Calendar.",
                    }

            phone_str = str(customer_phno).strip()

            # 1. Create or update customer record in database
            customer = await create_customer(
                name=customer_name,
                phone=phone_str,
            )
            customer_id = customer["id"]

            event_id = None
            google_synced = 0

            # 2. Check if Google Calendar integration is turned ON
            if is_google_calendar_enabled():
                try:
                    event = await asyncio.to_thread(
                        google_create_event,
                        summary=f"ABC Health Care: {customer_name} ({doctor_name})",
                        start=start,
                        end=end,
                        description=(
                            f"Patient: {customer_name}\n"
                            f"Phone: {phone_str}\n"
                            f"Doctor: {doctor_name} ({doctor_spec})\n"
                            f"Clinic: ABC Health Care\n"
                            f"Reason for Visit: {reason or doctor_spec + ' Consultation'}"
                        ),
                    )
                    event_id = getattr(event, "id", None)
                    google_synced = 1
                except Exception as g_err:
                    event_id = None
                    google_synced = 0

            # 3. Save appointment in local database
            appointment_record = await save_appointment(
                customer_id=customer_id,
                doctor_id=assigned_doctor_id,
                calendar_event_id=event_id,
                start_time=start,
                end_time=end,
                reason=reason or f"Consultation with {doctor_name}",
                status="scheduled",
                google_synced=google_synced,
            )

            # 4. Save appointment note in customer memory
            try:
                await save_memory(
                    customer_id=customer_id,
                    memory=f"Booked appointment at ABC Health Care with {doctor_name} ({doctor_spec}) for {reason or 'general medical consultation'} on {start.strftime('%Y-%m-%d at %I:%M %p')}",
                )
            except Exception:
                pass

            await broadcast_tool_status(context, "book_appointment", f"Appointment confirmed for {customer_name} with {doctor_name}!", "completed")
            return {
                "success": True,
                "message": f"Appointment booked and saved successfully with {doctor_name} ({doctor_spec}).",
                "customer_id": str(customer_id),
                "doctor_id": assigned_doctor_id,
                "doctor_name": doctor_name,
                "doctor_specialization": doctor_spec,
                "appointment_id": str(appointment_record["id"]) if appointment_record else None,
                "event_id": appointment_record.get("calendar_event_id") if appointment_record else event_id,
                "customer": customer_name,
                "phone": phone_str,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "google_calendar_synced": bool(google_synced),
            }

        except Exception as e:
            await broadcast_tool_status(context, "book_appointment", f"Booking error: {e}", "error")
            return {
                "success": False,
                "error": str(e),
            }

    @function_tool
    async def cancel_appointment(
        self,
        context: RunContext,
        event_id: str,
    ) -> dict:
        """Cancel an existing patient appointment at ABC Health Care."""
        await broadcast_tool_status(context, "cancel_appointment", "Cancelling appointment...", "running")
        try:
            if is_google_calendar_enabled():
                try:
                    await asyncio.to_thread(google_delete_event, event_id)
                except Exception:
                    pass

            # Update status in local database
            await update_appointment_status(event_id, "cancelled")
            await broadcast_tool_status(context, "cancel_appointment", "Appointment cancelled successfully.", "completed")

            return {
                "success": True,
                "message": "Appointment cancelled successfully.",
                "event_id": event_id,
            }

        except Exception as e:
            await broadcast_tool_status(context, "cancel_appointment", f"Cancellation error: {e}", "error")
            return {
                "success": False,
                "error": str(e),
            }

    @function_tool
    async def reschedule_appointment(
        self,
        context: RunContext,
        event_id: str,
        new_start_time: str,
        duration_minutes: int = 30,
    ) -> dict:
        """Reschedule an existing patient appointment at ABC Health Care."""
        await broadcast_tool_status(context, "reschedule_appointment", f"Rescheduling appointment to {new_start_time}...", "running")
        try:
            tz = ZoneInfo("Asia/Kolkata")
            start = datetime.fromisoformat(new_start_time)
            if start.tzinfo is None:
                start = start.replace(tzinfo=tz)

            end = start + timedelta(minutes=duration_minutes)

            # Check availability
            local_free = await check_local_availability(start, end, exclude_appointment_id=event_id)
            if not local_free:
                await broadcast_tool_status(context, "reschedule_appointment", "The new time slot is not available.", "error")
                return {
                    "success": False,
                    "error": "The new time slot is not available.",
                }

            if is_google_calendar_enabled():
                try:
                    await asyncio.to_thread(
                        google_update_event,
                        event_id=event_id,
                        start=start,
                        end=end,
                    )
                except Exception:
                    pass

            # Update start and end time in database
            await update_appointment_time(
                calendar_event_id_or_id=event_id,
                start_time=start,
                end_time=end,
            )
            await broadcast_tool_status(context, "reschedule_appointment", f"Rescheduled to {start.strftime('%b %d at %I:%M %p')}.", "completed")

            return {
                "success": True,
                "message": "Appointment rescheduled successfully.",
                "event_id": event_id,
                "new_start": start.isoformat(),
                "new_end": end.isoformat(),
            }

        except Exception as e:
            await broadcast_tool_status(context, "reschedule_appointment", f"Reschedule error: {e}", "error")
            return {
                "success": False,
                "error": str(e),
            }

    @function_tool
    async def end_call(
        self,
        context: RunContext,
    ) -> dict:
        """End or hang up the phone call with the patient when the conversation has ended, or when the patient says goodbye or wants to disconnect."""
        await broadcast_tool_status(context, "end_call", "Ending consultation call...", "running")
        async def _delayed_disconnect():
            try:
                await asyncio.sleep(2.5)
                if context.session:
                    if getattr(context.session, "room_io", None) and getattr(context.session.room_io, "room", None):
                        await context.session.room_io.room.disconnect()
                    context.session.shutdown(drain=True)
            except Exception:
                pass

        asyncio.create_task(_delayed_disconnect())

        return {
            "success": True,
            "message": "Call is ending. Say a warm and polite farewell to the patient before hanging up.",
        }