import styled from 'styled-components'

export const Wrapper = styled.section`
  padding: 16px;
  display: flex;
  flex-direction: column;
`

export const ListOfTanks = styled.section`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  grid-gap: 8px;
`

export const LinkContainer = styled.section`
  padding-top: 16px;
  padding-bottom: 25px;
  display: flex;
  flex-direction: column;
  align-items: center;
`
