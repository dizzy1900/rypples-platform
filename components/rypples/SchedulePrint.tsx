"use client";
import { Button } from "@/components/ui";
import { IconPrint } from "@/components/ui/icons";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <IconPrint size={16} />
      Print or save as PDF
    </Button>
  );
}
