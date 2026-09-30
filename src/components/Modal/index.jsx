import React from 'react'
import ReactDOM from 'react-dom'
import { Overlay, Content } from './styles'

function Modal({ children, closeModal }) {
  const handleClick = event => {
    event.stopPropagation()
  }

  return ReactDOM.createPortal(
    <Overlay onClick={closeModal}>
      <Content onClick={handleClick}>{children}</Content>
    </Overlay>,
    document.getElementById('modal')
  )
}

export default React.memo(Modal)
