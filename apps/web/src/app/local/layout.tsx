import { LocalGameProvider } from "@/features/local/LocalGameContext";

export default function LocalLayout({ children }: { children: React.ReactNode }) {
  return <LocalGameProvider>{children}</LocalGameProvider>;
}
