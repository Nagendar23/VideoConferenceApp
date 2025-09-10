import { io } from 'socket.io-client';
import { createContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
export const AuthContext = createContext();

export const client = axios.create({
  baseURL: "http://localhost:8000/api/v1/users",
});

export const AuthProvider = ({ children }) => {
  const [userData, setUserData] = useState(null);

  const handleRegister = async (name, username, password) => {
    try {
      let request = await client.post("/register", {
        name: name,
        username: username,
        password: password,
      });

      if (request.status === 201) {
        return request.data.message;
      }
    } catch (err) {
      throw err;
    }
  };

  const handleLogin = async (username, password) => {
    try {
      let request = await client.post("/login", {
        username: username,
        password: password,
      });
      console.log(request.data)
      if (request.status === 200) {
        localStorage.setItem("token", request.data.token);
        // return('/home')
      }
    } catch (err) {
      throw err;
    }
  };

  const navigate = useNavigate();

  const data = {
    userData,
    setUserData,
    handleRegister,
    handleLogin, 
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};
