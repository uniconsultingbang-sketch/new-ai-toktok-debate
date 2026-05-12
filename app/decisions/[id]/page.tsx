import { StreamingDecisionView } from "@/components/StreamingDecisionView";

type DecisionPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DecisionPage({ params }: DecisionPageProps) {
  const { id } = await params;

  return <StreamingDecisionView decisionId={id} />;
}
