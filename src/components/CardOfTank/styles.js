import styled from 'styled-components'

export const Card = styled.div`
  width: 100%;
  background: ${({ theme }) => theme.card};
  border-radius: 8px;
  padding: 8px;
  display: grid;
  grid-template-columns: min-content 1fr;
  grid-gap: 8px;
  align-items: center;
`
