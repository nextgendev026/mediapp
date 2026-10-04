import { notFound, redirect } from 'next/navigation';
import { ConsultRoom } from '@/components/consult/ConsultRoom';
import { requireRole } from '@/lib/server/guard';
import { getDb, type Encounter } from '@/lib/server/store';

export const dynamic = 'force-dynamic';

interface RoomView {
  appointmentId?: string | undefined;
  encounterId?: string | undefined;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  mode: string;
  date: string;
  time: string;
  reason: string;
  status: string;
  existingEncounter?: Encounter | undefined;
}

export default async function ProviderConsultationRoomPage({ params }: { params: { id: string } }) {
  const guard = await requireRole(['provider']);
  if ('error' in guard) redirect(guard.error.status === 401 ? '/login' : '/provider/dashboard');

  const db = await getDb();
  const callerId = guard.caller.userId;

  const appointment = db.appointments.find((a) => a.id === params.id && a.providerId === callerId);
  if (appointment) {
    const patient = db.users.find((u) => u.id === appointment.patientId);
    if (!patient) notFound();
    const provider = db.users.find((u) => u.id === appointment.providerId);
    const encounter = db.encounters.find((e) => e.appointmentId === appointment.id);
    const view: RoomView = {
      appointmentId: appointment.id,
      encounterId: encounter?.id,
      patientId: patient.id,
      patientName: patient.fullName,
      providerId: appointment.providerId,
      providerName: provider?.fullName ?? guard.caller.name,
      mode: appointment.mode,
      date: appointment.date,
      time: appointment.time,
      reason: appointment.reason,
      status: appointment.status,
      existingEncounter: encounter
    };
    return <ConsultRoom {...view} isProvider />;
  }

  const encounterRow = db.encounters.find((e) => e.id === params.id && e.providerId === callerId);
  if (encounterRow) {
    const linked = encounterRow.appointmentId
      ? db.appointments.find((a) => a.id === encounterRow.appointmentId)
      : undefined;
    const patient = db.users.find((u) => u.id === encounterRow.patientId);
    if (!patient) notFound();
    const provider = db.users.find((u) => u.id === encounterRow.providerId);
    const view: RoomView = {
      appointmentId: encounterRow.appointmentId,
      encounterId: encounterRow.id,
      patientId: patient.id,
      patientName: patient.fullName,
      providerId: encounterRow.providerId,
      providerName: provider?.fullName ?? guard.caller.name,
      mode: linked?.mode ?? 'chat',
      date: linked?.date ?? encounterRow.date,
      time: linked?.time ?? '',
      reason: linked?.reason ?? encounterRow.diagnosis ?? encounterRow.soap.assessment,
      status: linked?.status ?? 'completed',
      existingEncounter: encounterRow
    };
    return <ConsultRoom {...view} isProvider />;
  }

  notFound();
}
