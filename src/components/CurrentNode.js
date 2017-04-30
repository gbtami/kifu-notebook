import React, { Component } from 'react';
import './CurrentNode.css';

import ForkList from './ForkList';

export default class CurrentNode extends Component {
  render() {
    const { jumpMap, currentNode, currentPath,
      previousPath, nextPath, previousForkPath, nextForkPath } = this.props;

    return (
      <div>
        <div>
          {(currentNode.tesuu === 0 ? null : currentNode.tesuu + "手目")} {currentNode.readableKifu}
        </div>
        <textarea
          rows="10"
          className="comment"
          placeholder="ここに現在の手についてコメントを書けます。"
          onChange={e => { this.props.onChangeComments(e.target.value); }}
          value={currentNode.comment}></textarea>
        <div className="buttons">
          <button
            onClick={e => this.props.onClickPath(previousForkPath)}
            title="1つ前の分岐に戻る">&laquo;</button>
          <button
            onClick={e => this.props.onClickPath(previousPath)}
            title="1手戻る">&lt;</button>
          <button
            onClick={e => this.props.onClickPath(nextPath)}
            title="1手進む">&gt;</button>
          <button
            onClick={e => this.props.onClickPath(nextForkPath)}
            title="1つ先の分岐に進む">&raquo;</button>
        </div>
        <ForkList
          currentNode={currentNode}
          currentPath={currentPath}
          jumpMap={jumpMap}
          onClickForward={this.props.onClickForward}
          onClickPath={this.props.onClickPath} />
      </div>
    )
  }
}