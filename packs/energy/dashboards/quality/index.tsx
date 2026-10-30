import {Dashboard,Stat} from '@open-dashboard/core'
export const meta={title:'Input invariants',description:'Validation only; excluded from delivered dashboard IDs'}
export default function Quality(){return <Dashboard><Stat title='Verified contracts' query='validation_summary' column='checks'/></Dashboard>}
