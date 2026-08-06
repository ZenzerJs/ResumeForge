import { NextResponse } from "next/server";
import { CreateJobSchema } from "@/lib/jd-parser/types";
import { createJob, getJobs } from "@/lib/db/jobs";

export async function GET() {
  try {
    const jobs = await getJobs();
    return NextResponse.json({ success: true, data: jobs });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs", message: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = CreateJobSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request payload",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const job = await createJob(validation.data);
    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Failed to create job", message: String(err) },
      { status: 500 }
    );
  }
}
