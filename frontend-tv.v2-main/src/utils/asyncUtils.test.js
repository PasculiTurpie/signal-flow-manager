import { test } from "node:test";
import assert from "node:assert/strict";
import {
    createKeyedDebounce,
    withRetry,
    prepareOptimisticUpdate,
} from "./asyncUtils.js";

test("createKeyedDebounce ejecuta solo la última llamada por clave", async () => {
    const calls = [];
    const debounce = createKeyedDebounce((key, value) => {
        calls.push({ key, value });
    }, 20);

    debounce("node-1", { x: 1 });
    debounce("node-1", { x: 2 });
    debounce("node-2", { x: 3 });

    await new Promise((resolve) => setTimeout(resolve, 35));

    assert.deepEqual(calls, [
        { key: "node-1", value: { x: 2 } },
        { key: "node-2", value: { x: 3 } },
    ]);
});

test("withRetry reintenta hasta que la función tenga éxito", async () => {
    let attempts = 0;
    const fn = async () => {
        attempts += 1;
        if (attempts < 3) {
            throw new Error("fail");
        }
        return "ok";
    };

    const retriable = withRetry(fn, { retries: 3, baseDelay: 1 });
    const result = await retriable();

    assert.equal(result, "ok");
    assert.equal(attempts, 3);
});

test("prepareOptimisticUpdate devuelve rollback funcional", () => {
    const nodes = [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 10, y: 10 } },
    ];
    const { next, rollback, original } = prepareOptimisticUpdate(
        nodes,
        "b",
        (node) => ({ ...node, position: { x: 50, y: 60 } })
    );

    assert.deepEqual(next[1].position, { x: 50, y: 60 });
    const restored = rollback(next);
    assert.deepEqual(restored[1], original);
});
