/// <reference types="cypress" />

const SAMPLE_CHANNEL_ID = "507f1f77bcf86cd799439011";

describe("Channel diagram flows", () => {
  it.skip("creates nodes, edits labels, and persists coordinates", () => {
    // This test requires the frontend dev server and backend API running.
    // When executed in CI, ensure the app is served at http://localhost:5173
    // and the API responds with fixtures for the sample channel.
    cy.visit(`/channels/${SAMPLE_CHANNEL_ID}`);

    // Create node
    cy.contains("button", /nuevo nodo/i).click();
    cy.get("input[name='nodeId']").type("Node-Z");
    cy.contains("button", /guardar nodo/i).click();

    // Edit label and drag position
    cy.contains("Node-Z").dblclick();
    cy.focused().clear().type("Nodo Zeta{enter}");
    cy.contains("Nodo Zeta").trigger("pointerdown", { clientX: 200, clientY: 200 });
    cy.window().trigger("pointermove", { clientX: 420, clientY: 280 });
    cy.window().trigger("pointerup", { clientX: 420, clientY: 280 });

    // Persist label positions
    cy.contains(/guardar diagrama/i).click();

    cy.reload();
    cy.contains("Nodo Zeta").should("exist");
  });

  it.skip("removes nodes and edges and persists endpoint label positions", () => {
    cy.visit(`/channels/${SAMPLE_CHANNEL_ID}`);

    cy.contains(/edge-a-b/i)
      .trigger("pointerdown", { clientX: 260, clientY: 200 })
      .trigger("pointerup", { clientX: 260, clientY: 200 });

    cy.window().trigger("keydown", { key: "Delete" });
    cy.contains("button", /confirmar eliminación/i).click();

    cy.reload();
    cy.contains(/edge-a-b/i).should("not.exist");
  });
});
