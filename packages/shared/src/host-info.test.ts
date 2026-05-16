import { afterEach, describe, expect, test } from "bun:test";
import { getHostId } from "./host-info";

const originalOverride = process.env.SUPERSET_HOST_ID;

afterEach(() => {
	if (originalOverride === undefined) {
		delete process.env.SUPERSET_HOST_ID;
	} else {
		process.env.SUPERSET_HOST_ID = originalOverride;
	}
});

describe("getHostId", () => {
	test("uses SUPERSET_HOST_ID when provided", () => {
		process.env.SUPERSET_HOST_ID = "host.override_1";

		expect(getHostId()).toBe("host.override_1");
	});

	test("rejects unsafe override characters", () => {
		process.env.SUPERSET_HOST_ID = "bad/host:id";

		expect(() => getHostId()).toThrow("SUPERSET_HOST_ID");
	});
});
