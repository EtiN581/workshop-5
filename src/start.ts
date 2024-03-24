/*import { launchNetwork } from ".";
import { startConsensus } from "./nodes/consensus";
import { Value } from "./types";
import { delay } from "./utils";

async function main() {
  const faultyArray = [
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    false,
    false,
    false,
  ];

  const initialValues: Value[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

  if (initialValues.length !== faultyArray.length)
    throw new Error("Lengths don't match");

  if (
    faultyArray.filter((faulty) => faulty === true).length >
    initialValues.length / 2
  )
    throw new Error("Too many faulty nodes");

  await launchNetwork(
    initialValues.length,
    faultyArray.filter((el) => el === true).length,
    initialValues,
    faultyArray
  );

  await delay(200);

  await startConsensus(initialValues.length);
}

main();*/

import * as http from "http";
import { launchNetwork } from "./index";
import { startConsensus, stopConsensus } from "./nodes/consensus";
import { delay } from "./utils";
import { BASE_NODE_PORT } from "./config";
import { getNodesState, reachedFinality } from "../__test__/tests//utils";
import { Value } from "./types";

async function main() {
  const servers: http.Server[] = [];

  const timeLimit = 2000; // 2s

  const faultyArray = [false, false, false, false, false];

  const initialValues: Value[] = [1, 1, 1, 1, 1];

  const _servers = await launchNetwork(
      faultyArray.length,
      faultyArray.filter((el) => el === true).length,
      initialValues,
      faultyArray)
  servers.push(..._servers);

  await startConsensus(faultyArray.length);

  const time = new Date().getTime();

  let states = await getNodesState(faultyArray.length);

  while (
    new Date().getTime() - time < timeLimit &&
    !reachedFinality(states)
  ) {
    await delay(200);

    states = await getNodesState(faultyArray.length);
  }

  for (let index = 0; index < states.length; index++) {
    const state = states[index];

    if (faultyArray[index]) {
      expect(state.decided).toBeNull();
      expect(state.x).toBeNull();
      expect(state.k).toBeNull();
    } else {
      expect(state.decided).toBeTruthy();
      expect(state.x).toBe(1);
      expect(state.k).toBeLessThanOrEqual(2);
    }
  }
  throw Error
}
main()






  

  