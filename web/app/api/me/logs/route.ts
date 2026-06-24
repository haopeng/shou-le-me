import { NextRequest, NextResponse } from "next/server";
import {
  getAuthContext,
  isAuthContext,
  jsonError,
  requireDate,
  requirePositiveWeight
} from "../../_lib/server";
import { deleteUserWeightLog, saveUserWeightLog } from "../../_lib/weightLogs";

export async function POST(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const body = await request.json().catch(() => ({}));
  const recordedOn = requireDate(body.recordedOn);
  const weightKg = requirePositiveWeight(body.weightKg);

  if (!recordedOn || !weightKg) {
    return jsonError("Valid weight and date are required.", 422, "WEIGHT_REQUIRED");
  }

  try {
    const result = await saveUserWeightLog({
      admin: context.admin,
      userId: context.user.id,
      recordedOn,
      weightKg,
      note: body.note
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save weight.", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const context = await getAuthContext(request);
  if (!isAuthContext(context)) {
    return context;
  }

  const recordedOn = requireDate(request.nextUrl.searchParams.get("date"));

  if (!recordedOn) {
    return jsonError("Date is required.", 422, "DATE_REQUIRED");
  }

  try {
    const result = await deleteUserWeightLog({
      admin: context.admin,
      userId: context.user.id,
      recordedOn
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not delete weight.", 500);
  }
}
