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

  let proposals: Map<number, Value[]> = new Map()
  let votes: Map<number, Value[]> = new Map()

  // TODO implement this
  // this route allows retrieving the current status of the node
  node.get("/status", (req, res) => {
    if(isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  });


  // consensus(vp)                                                                          { vp is the initial value of process p }
  // 1:  x := vp                                                                            { x is p's current estimate of the decision value }
  // 2:  k := 0
  // 3: while True do
  // 4:   k := k + 1                                                                        { k is the current phase number }
  // 5:   send (x, k) to all processes
  // 6:   wait for messages of the form (R, k, *) from n-f processes                        { "*" can be 0 or 1 }
  // 7:   if recceived more than n/2 (R, k, v) with the same v
  // 8:   then send (P, k, v) to all processes
  // 9:   else send (P, k, ?) to all processes
  // 10:  wait for messages of the form (P, k, *) from n-f processes                        { "*" can be 0, 1 or ? }
  // 11:  if received at least f+1 (P, k, *) from n-f processes then decide(v)
  // 12:  if at least one (P, k, v) with v /= ? then x := v else x := 0 or 1 randomly       { query r.n.g.}

  // TODO implement this
  // this route allows the node to receive messages from other nodes
  node.post("/message", (req, res) => {
    let {x, k, type} = req.body;
    if (!isFaulty && !state.killed) {
      if (type === "propose") {
        if (!proposals.has(k)) proposals.set(k, []);
        proposals.get(k)!.push(x);
        let proposal = proposals.get(k)!;

        if (proposal.length >= (N-F)) {
          let counts = Count(proposal);
          if (counts[0] >= (N/2)) x=0;
          else if (counts[1] > (N/2)) x=1;
          else x = "?"
          SendToAll(x, k, "vote");
        }

      } else if (type === "vote") {
        if (!votes.has(k)) {
          votes.set(k, []);
        }
        votes.get(k)!.push(x);
        let vote = votes.get(k)!;
        if (vote.length >= (N-F)) {
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
            SendToAll(state.x, state.k, "propose")
          }
        }
      }
    }
    res.status(200)
  });

  function SendToAll(x:Value, k:number|null, type:string) {
    for (let i = 0; i < N; i++) {
      if (i !== nodeId) {
        fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            x: x,
            k: k,
            type: type
          }),
        });
      }
    }
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
    while(!nodesAreReady()) await delay(10);
    if (!isFaulty) {
      state.x = initialValue;
      state.k = 1;
      state.decided = false
      SendToAll(state.x, state.k, "propose")
    } else {
      state.x = null;
      state.decided = null;
      state.k = null;
    }

    res.status(200)
  });

  // TODO implement this
  // this route is used to stop the consensus algorithm
  node.get("/stop", async (req, res) => {
    state.killed=true;
    res.status(200).send("killed");
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
