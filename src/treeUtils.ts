import { JKFPlayer, JSONKifuFormat, MoveFormat, MoveMoveFormat, TimeFormat, Shogi } from './shogiUtils';
import { List, Iterable, Record } from 'immutable';

export type Path = Iterable<number, number>;
export type SFEN = string;
export type JumpMap = { [sfen: string]: JumpTo[] };
export class KifuTreeNode extends Record({
  tesuu: 0,
  comment: '',
  move: undefined,
  time: undefined,
  special: undefined,
  readableKifu: '',
  sfen: undefined,
  children: List(),
  jumpTargets: List(),
}) {
  tesuu: number;
  comment?: string;
  move?: MoveMoveFormat;
  time?: {
    now: TimeFormat;
    total: TimeFormat
  };
  special?: string;
  readableKifu: string;
  sfen: SFEN;
  children: List<KifuTreeNode>;
  jumpTargets: List<JumpTarget>;

  isBad(): boolean {
    return !!this.comment && this.comment.startsWith('bad:');
  }
}

export class JumpTarget extends Record({
  path: null,
  comment: '',
  readableKifu: '',
}) {
  path: Path;
  comment: string;
  readableKifu: string;

  isBad(): boolean {
    return !!this.comment && this.comment.startsWith('bad:');
  }
}

export class JumpTo extends Record({
  node: null,
  path: null,
}) {
  node: KifuTreeNode;
  path: Path;
}

export function jkfToKifuTree(jkf: JSONKifuFormat): KifuTreeNode {
  const shogi = new JKFPlayer(jkf).shogi;
  const kifuTree = createKifuTreeNode(shogi, 0, jkf.moves);
  //fillSFEN(kifuTree, jkf);
  return kifuTree;
}

export function createKifuTreeNode(shogi: Shogi, tesuu: number, moveFormats: MoveFormat[]): KifuTreeNode {
  const moveFormat = moveFormats[0];
  //console.log(tesuu, moveFormats);
  return new KifuTreeNode({
    tesuu: tesuu,
    comment: moveFormat.comments ? moveFormat.comments.join('\n') : '',
    move: moveFormat.move,
    time: moveFormat.time,
    special: moveFormat.special,
    readableKifu: tesuu === 0 ? '開始局面' : JKFPlayer.moveToReadableKifu(moveFormat),
    sfen: shogi.toSFENString(tesuu + 1),
    children: List(moveFormatsToForks(moveFormats).map((moveFormatsOfFork, i) => {
      JKFPlayer.doMove(shogi, moveFormatsOfFork[0].move);
      const childNode = createKifuTreeNode(shogi, tesuu + 1, moveFormatsOfFork);
      JKFPlayer.undoMove(shogi, moveFormatsOfFork[0].move);
      return childNode;
    })),
  });
}

function moveFormatsToForks(moveFormats: MoveFormat[]): MoveFormat[][] {
  let forks: MoveFormat[][] = [];
  if (moveFormats.length >= 2) {
    forks.push(moveFormats.slice(1));
  }

  if (moveFormats[1] && moveFormats[1].forks) {
    forks = forks.concat(moveFormats[1].forks as MoveFormat[][]);
  }
  return forks;
}

export function traverseTree(rootNode: KifuTreeNode, callback: (node: KifuTreeNode, path: Path) => void): void {
  const stack: { path: Path, node: KifuTreeNode }[] = [];
  stack.push({ path: List<number>(), node: rootNode });

  while (true) {
    const currentNode = stack.pop();
    if (!currentNode) {
      break;
    }
    callback(currentNode.node, currentNode.path);

    for (let i = currentNode.node.children.size - 1; i >= 0; i--) {
      const node = currentNode.node.children.get(i);
      const path = currentNode.path.concat(i);
      stack.push({ node, path });
    }
  }
}

export function buildJumpMap(rootNode: KifuTreeNode): JumpMap {
  // const begin = new Date();
  const jumpMap: JumpMap = {};
  const seen: { [sfen: string]: JumpTo } = {};

  traverseTree(rootNode, (node: KifuTreeNode, path: Path) => {
    const sfen = node.sfen;
    const jumpTo = new JumpTo({
      node: node,
      path: path,
    });
    if (seen[sfen]) {
      if (!jumpMap[sfen]) {
        jumpMap[sfen] = [seen[sfen]];
      }
      jumpMap[sfen].push(jumpTo);
    } else {
      seen[sfen] = jumpTo;
    }
  });

  // const end = new Date();
  // console.log(`buildJumpMap: ${end.getTime() - begin.getTime()}ms`);
  // console.log(jumpMap);

  return jumpMap;
}

export function kifuTreeToJKF(kifuTree: KifuTreeNode, baseJKF: JSONKifuFormat): JSONKifuFormat {
  const firstMove = Object.assign({}, baseJKF.moves[0]);
  firstMove.comments = kifuTree.comment ? kifuTree.comment.split('\n') : undefined;

  // key order is important for readability
  const newJKF = {
    header: baseJKF.header,
    initial: baseJKF.initial,
    moves: [firstMove].concat(nodesToMoveFormats(kifuTree.children.toArray())),
  };
  return newJKF;
}

function nodesToMoveFormats(nodes: KifuTreeNode[]): MoveFormat[] {
  const primaryNode = nodes[0];

  if (!primaryNode) {
    return [];
  }

  // key order is important for readability
  const primaryMoveFormat: MoveFormat = {
    comments: primaryNode.comment ? primaryNode.comment.split('\n') : undefined,
    move: primaryNode.move,
    time: primaryNode.time,
    special: primaryNode.special,
    forks: nodes.length >= 2 ? nodes.slice(1).map(childNode => nodesToMoveFormats([childNode]))
      : undefined,
  };

  return [primaryMoveFormat].concat(nodesToMoveFormats(primaryNode.children.toArray()));
}

export function getNodesOnPath(tree: KifuTreeNode, path: Path): KifuTreeNode[] {
  const nodes: KifuTreeNode[] = [];
  let currentNode = tree;
  path.forEach((num: number) => {
    currentNode = currentNode.children.get(num);
    nodes.push(currentNode);
  });

  return nodes;
}

export function getStringPathFromPath(tree: KifuTreeNode, path: Path): string[] {
  return getNodesOnPath(tree, path).map(node => node.readableKifu);
}

export function getPathFromStringPath(tree: KifuTreeNode, stringPath: string[]): Path {
  const path: number[] = [];
  let currentNode = tree;
  for (let kifu of stringPath) {
    const nextNodeIndex = currentNode.children.findIndex((childNode: KifuTreeNode): boolean => childNode.readableKifu === kifu);
    if (nextNodeIndex < 0) {
      break;  // stop if node is missing (e.g. node is removed)
    }
    const nextNode = currentNode.children.get(nextNodeIndex);

    path.push(nextNodeIndex);
    currentNode = nextNode;
  }

  return List(path);
}

export function pathToKeyPath(path: Path): (string | number)[] {
  const keyPath: (string | number)[] = [];
  path.forEach((num: number) => {
    keyPath.push('children');
    keyPath.push(num);
  });
  return keyPath;
}

export function findNodeByPath(tree: KifuTreeNode, path: Path): KifuTreeNode {
  if (path.size === 0) {
    return tree;
  }
  const nodes = getNodesOnPath(tree, path);
  return nodes[nodes.length - 1];
}
