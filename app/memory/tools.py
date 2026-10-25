from datetime import datetime
from livekit.agents import function_tool, RunContext

from app.memory.service import (
    get_customer_by_phone,
    create_customer,
    save_memory,
    search_memories,
    get_memories,
    get_customer_appointments,
)
from app.tools import broadcast_tool_status


class MemoryTools:

    @function_tool
    async def find_customer(
        self,
        context: RunContext,
        phone: str,
    ) -> str:
        """Find an existing patient record using their phone number at ABC Health Care."""
        await broadcast_tool_status(context, "find_customer", f"Searching patient records for {phone}...", "running")
        customer = await get_customer_by_phone(phone)

        if not customer:
            await broadcast_tool_status(context, "find_customer", "Patient record not found in system.", "completed")
            return "Patient record not found at ABC Health Care."

        await broadcast_tool_status(context, "find_customer", f"Found record for {customer['name']}.", "completed")
        info_lines = [
            f"Customer ID (Patient ID): {customer['id']}",
            f"Patient Name: {customer['name']}",
            f"Phone: {customer['phone']}",
        ]

        # Include recent appointments if any
        try:
            appointments = await get_customer_appointments(customer["id"], limit=3)
            if appointments:
                info_lines.append("Recent Appointments at ABC Health Care:")
                for appt in appointments:
                    start_val = appt["start_time"]
                    if isinstance(start_val, str):
                        try:
                            start_val = datetime.fromisoformat(start_val)
                        except Exception:
                            pass
                    start_str = start_val.strftime("%Y-%m-%d %I:%M %p") if isinstance(start_val, datetime) else str(start_val)
                    doc_info = f" with {appt['doctor_name']} ({appt['doctor_specialization']})" if appt.get("doctor_name") else ""
                    info_lines.append(
                        f"  - {start_str}: {appt['reason'] or 'Consultation'}{doc_info} (Status: {appt['status']}, Event ID: {appt['calendar_event_id']})"
                    )
        except Exception:
            pass

        # Include recent memories if any
        try:
            memories = await get_memories(customer["id"], limit=3)
            if memories:
                info_lines.append("Patient Notes/Preferences:")
                for m in memories:
                    info_lines.append(f"  - {m['memory']}")
        except Exception:
            pass

        return "\n".join(info_lines)

    @function_tool
    async def save_customer(
        self,
        context: RunContext,
        name: str,
        phone: str,
    ) -> str:
        """Create or update a patient record in the ABC Health Care database."""
        await broadcast_tool_status(context, "save_customer", f"Saving patient profile for {name}...", "running")
        customer = await create_customer(name=name, phone=phone)
        await broadcast_tool_status(context, "save_customer", f"Patient profile saved for {name}.", "completed")

        return (
            f"Patient profile saved successfully at ABC Health Care.\n"
            f"Customer ID: {customer['id']}\n"
            f"Name: {customer['name']}\n"
            f"Phone: {customer['phone']}"
        )

    @function_tool
    async def remember(
        self,
        context: RunContext,
        customer_id: str,
        memory: str,
    ) -> str:
        """Save useful long-term information about a patient at ABC Health Care (preferences, doctor choices, notes)."""
        await broadcast_tool_status(context, "remember", "Saving patient preference and context...", "running")
        try:
            await save_memory(
                customer_id=customer_id,
                memory=memory,
            )
            await broadcast_tool_status(context, "remember", "Patient preference saved.", "completed")
            return "Memory saved successfully."
        except Exception as e:
            await broadcast_tool_status(context, "remember", f"Error saving memory: {e}", "error")
            return f"Failed to save memory: {e}"

    @function_tool
    async def recall(
        self,
        context: RunContext,
        customer_id: str,
        query: str,
    ) -> str:
        """Search the patient's memories and notes using semantic similarity or recent notes."""
        await broadcast_tool_status(context, "recall", f"Retrieving medical history for '{query}'...", "running")
        try:
            memories = await search_memories(
                customer_id=customer_id,
                query=query,
                limit=5,
            )

            relevant_memories = [
                row
                for row in memories
                if row.get("similarity", 0) >= 0.60
            ]

            if not relevant_memories:
                await broadcast_tool_status(context, "recall", "No prior notes found.", "completed")
                return "No relevant memories found."

            await broadcast_tool_status(context, "recall", f"Found {len(relevant_memories)} historical notes.", "completed")
            return "\n".join(
                f"- {row['memory']}"
                for row in relevant_memories
            )
        except Exception as e:
            await broadcast_tool_status(context, "recall", f"Error recalling notes: {e}", "error")
            return f"Failed to recall memories: {e}"