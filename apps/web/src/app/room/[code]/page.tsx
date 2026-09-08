import type { Metadata } from "next";
import { RoomLobby } from "@/features/online/RoomLobby";

export const metadata: Metadata = {
  title: "Room",
  robots: { index: false, follow: false },
};

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomLobby code={code.toUpperCase()} />;
}
