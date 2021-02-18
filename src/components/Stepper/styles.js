import styled from 'styled-components'
const badgeSize = '20px'

export const StepContainer = styled.div`
    max-width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
`
export const Step = styled.div`
    display: grid;
    grid-template-columns: ${badgeSize} 1fr;
    gap: 8px;
`
export const BadgeContainer = styled.div`
    display: grid;
    grid-template-rows: ${badgeSize} 1fr;
    justify-items: center;
`

export const Line = styled.div`
    width: 1px;
    height: 100%;
    background-color: ${({ theme }) => theme.secondaryText};
    bottom: 0;
`

export const Badge = styled.div`
    font-size: 12px;
    width: ${badgeSize};
    height: ${badgeSize};
    border-radius: 50%;
    background-color: ${({ theme, completed }) =>
        completed ? theme.accent : theme.secondaryText};
    color: ${({ theme }) => theme.primaryText};
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
`
