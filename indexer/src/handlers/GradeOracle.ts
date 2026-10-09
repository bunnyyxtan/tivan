import { indexer } from "envio";

// Grades the Chainlink CRE workflow verified on the oracle network and wrote to GradeOracle. The card page shows them
// next to each certificate, so anyone can see the grade came from the grader registry through Chainlink, not a person.
indexer.onEvent({ contract: "GradeOracle", event: "GradeVerified" }, async ({ event, context }) => {
  context.GradeCheck.set({
    id: event.params.certId.toString(),
    specId: event.params.specId,
    grade: Number(event.params.grade),
    holder: event.params.holder,
    name: event.params.name,
    verifiedAt: event.block.timestamp,
    txHash: event.transaction.hash,
  });
});
