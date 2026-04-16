import { DemoApp } from "@/components/demo-app";
import { getDemoState } from "@/lib/store";

export default async function Home() {
  const initialState = await getDemoState();

  return <DemoApp initialState={initialState} />;
}
