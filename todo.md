

# Todo later
- Add the http request that happens in <Game> to a hook.

# Todo laterr
- maybe set up auto reformatting on save (look more into eslint)
- set up best practice documentation for ai models to use to give better edits
- Can format the pgn text like Chess.com
  - Can allow clicking & navigating through that pgn text like chess.com. Can make separate explore tab.
- Create monorepo structure to share types, pgn-parser.ts, etc.

# Implementation ideas
- For implementing use-game & save state:
  - create globally available hashNode = (node: NodeType) that is pgn + '||' + moveText. 
  - store visitedNodeHashes in pgn

# Future ideas
- Allow folders to group pgn's

# Design decision justification

- Whether to implement game progress destructively: no
  - I think implementing a clickable interface like Chess.com would be way simpler if I didn't distinguish between previously played moves and current ones. Saving progress should still be pretty straight forward — it's just a question of whether to delete lastBranchingNode from its parent, or to add it to a set to make sure not to visit it again.

# Questions:
marked // Question: 