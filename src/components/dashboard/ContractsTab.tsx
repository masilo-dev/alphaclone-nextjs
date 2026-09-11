'use client';

import React from 'react';
import { User } from '../../types';
import ContractDashboard from '../contracts/ContractDashboard';

interface ContractsTabProps {
  user: User;
}

const ContractsTab: React.FC<ContractsTabProps> = ({ user }) => {
  return (
    <div className="w-full h-full bg-slate-950 p-2 sm:p-4 rounded-3xl ac-scroll-full ac-enterprise-module">
      <ContractDashboard user={user} initialTab="list" />
    </div>
  );
};

export default ContractsTab;
