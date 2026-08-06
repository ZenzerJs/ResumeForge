import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16">
      <Card className="w-full max-w-lg border-border/80 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <CardHeader className="items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            R
          </div>
          <CardTitle className="text-2xl text-foreground">ResumeForge</CardTitle>
          <CardDescription className="max-w-sm text-base leading-relaxed">
            Local-first AI resume workspace. Craft truthful, job-specific variants
            from one protected master resume.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 pb-8">
          <Link
            href="/editor"
            className={cn(buttonVariants({ size: "lg" }), "min-h-11 gap-2")}
          >
            <FileText className="h-4 w-4" />
            Open Typst Workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/library"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground",
            )}
          >
            Evidence Library
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
