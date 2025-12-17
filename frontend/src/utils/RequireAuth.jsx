import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const RequireAuth = ({ children }) => {
    // We can access the context, but for simple persistence check without 
    // waiting for async initialization, checking localStorage is often faster/synch.
    // However, ideally we use the context.
    // Let's use localStorage directly here to "fix" it quickly as requested, 
    // ensuring purely client-side routing protection.
    const token = localStorage.getItem("token");

    if (!token) {
        return <Navigate to="/auth" />;
    }

    return children;
};

export default RequireAuth;
