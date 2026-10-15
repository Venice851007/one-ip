import { explainIpAssessment, scoreIpEvidence } from "@/lib/ip-assessment";
import { endpoint } from "@/lib/network";
import { useQuery } from "@tanstack/react-query";
import type { CoffeeLookup } from "./coffee";
import { sourceObservations, type FreeEvidence } from "./source-evidence";

export function useIpAssessment(data: CoffeeLookup) {
  const query = useQuery({
    queryKey: ["free-ip-evidence-v2", data.coffee.ip],
    queryFn: ({ signal }) =>
      endpoint<FreeEvidence>(
        `/ip/evidence/${encodeURIComponent(data.coffee.ip)}`,
        { signal },
      ),
    staleTime: 60_000,
    retry: false,
  });
  const sources = sourceObservations(
    data.coffee,
    query.data,
    data.queriedAt,
    data.sourceState,
  );
  const options = {
    primaryAvailable: data.sourceState !== "unavailable",
    queriedAt: data.queriedAt,
  };
  const assessment = explainIpAssessment({ ...data.coffee }, sources, options);
  const scoring = scoreIpEvidence({ ...data.coffee }, assessment, options);
  return { query, sources, assessment, scoring };
}
