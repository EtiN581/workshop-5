import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { NodeState, Value } from "../types";
import { delay } from "../utils";

export async function node(
  nodeId: number, // the ID of the node
  N: number, // total number of nodes in the network
  F: number, // number of faulty nodes in the network
  initialValue: Value, // initial value of the node
  isFaulty: boolean, // true if the node is faulty, false otherwise
  nodesAreReady: () => boolean, // used to know if all nodes are ready to receive requests
  setNodeIsReady: (index: number) => void // this should be called when the node is started and ready to receive requests
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  let state: NodeState = {
    killed: false,
    x: isFaulty ? null : initialValue,
    decided: isFaulty ? null : false,
    k: isFaulty ? null : 0
  }

  let proposals: Map<number, Value[]> = new Map();
  let votes: Map<number, Value[]> = new Map();

  // TODO implement this
  // this route allows retrieving the current status of the node
  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  });

  // TODO implement this
  // this route allows the node to receive messages from other nodes
  node.post("/message", (req, res) => {
    let { x, k, type } = req.body;
    if (isFaulty || state.killed) {
      res.status(500);
      return;
    }
    if (type === "propose") {
      updateMap(proposals, k, x);
      let proposal = proposals.get(k)!;
      if (proposal.length >= (N - F)) {
        let counts = Count(proposal);
        if (counts[0] >= (N / 2)) x = 0;
        else if (counts[1] > (N / 2)) x = 1;
        else x = "?";
        SendToAll(x, k, "vote");
      }
    } else if (type === "vote") {
      updateMap(votes, k, x)
      let vote = votes.get(k)!;
      if (vote.length >= (N - F)) {
        let counts = Count(vote);
        if (counts[0] >= F + 1) {
          state.x = 0;
          state.decided = true;
        } else if (counts[1] >= F + 1) {
          state.x = 1;
          state.decided = true;
        } else {
          if (counts[0] > counts[1]) state.x = 0;
          else if (counts[0] < counts[1]) state.x = 1;
          else state.x = Math.random() > 0.5 ? 0 : 1;
          state.k = k + 1;
          SendToAll(state.x, state.k, "propose");
        }
      }
    }
    res.status(200).send('Message received');
  });

  function SendToAll(x: Value, k: number | null, type: string) {
    for (let i = 0; i < N; i++) {
      fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          x: x,
          k: k,
          type: type
        }),
      });
    }
  }

  function updateMap(array: Map<number, Value[]>, k:number, x:Value) {
    if (array.has(k)) array.set(k, []);
    array.get(k)!.push(x);
  }

  function Count(values: Value[]) {
    let counts = [0, 0];
    values.forEach(v => {
      if (v !== "?") counts[v]++;
    })
    return counts
  }

  // TODO implement this
  // this route is used to start the consensus algorithm
  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) await delay(10);
    if (isFaulty) {
      state.x = null;
      state.decided = null;
      state.k = null;
      res.status(500).send("faulty");
    } else {
      state.x = initialValue;
      state.k = 1;
      state.decided = false;
      SendToAll(state.x, state.k, "propose");
      res.status(200).send("Algorithm started");
    }
  });

  // TODO implement this
  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => {
    state.killed = true;
    res.status(200).send("stopped");
  });

  // TODO implement this
  // get the current state of a node
  node.get("/getState", (req, res) => {
    res.status(200).send(state);
  });

  // start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    // the node is ready
    setNodeIsReady(nodeId);
  });

  return server;
}