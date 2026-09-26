import './competition.css';
import Boss from './components/Boss.jsx';
import Driver from './components/Driver.jsx';
import Leader from './components/Leader.jsx';

const BY_ROLE = { fleet: Boss, lead: Leader, driver: Driver };

export default function Competition({ role }) {
  const Page = BY_ROLE[role];
  const className = role === 'lead' ? 'comp lead' : role === 'fleet' ? 'comp boss' : 'comp';
  return (
    <div className={className}>
      {Page ? <Page /> : null}
    </div>
  );
}
