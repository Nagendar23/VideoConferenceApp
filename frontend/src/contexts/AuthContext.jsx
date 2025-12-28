import { io } from 'socket.io-client';
import { createContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
export const AuthContext = createContext();

isProd = process.env.SERVER === 'production';
export const client = axios.create({

  baseURL: isProd ? process.env.BACKEND_URI + "/api/v1/users" : "http://localhost:8000/api/v1/users",
});

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);

  const handleRegister = async (name, email, username, password) => {
    try {
      let request = await client.post("/register", {
        name: name,
        email: email,
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

  const handleLogin = async (email, password) => {
    try {
      let request = await client.post("/login", {
        email: email,
        password: password,
      });
      console.log(request.data)
      if (request.status === 200) {
        localStorage.setItem("token", request.data.token);
        // Try to fetch user data, but don't fail login if it fails
        try {
          const userData = await getHistoryOfUser();
          setUserData(userData);
        } catch (error) {
          console.error("Failed to fetch user profile after login:", error);
        }
        return request.data;
      }
    } catch (err) {
      throw err;
    }
  };

  const getHistoryOfUser = async () => {
    try {
      let request = await client.get("/get_all_activity", {
        params: {
          token: localStorage.getItem("token")
        }
      });
      return request.data
    } catch (err) {
      throw err;
    }
  }

  const addToUserHistory = async (meetingCode) => {
    try {
      let request = await client.post("/add_to_activity", {
        token: localStorage.getItem("token"),
        meeting_code: meetingCode
      });
      return request
    } catch (e) {
      throw e;
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUserData(null);
    navigate("/auth");
  }

  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const history = await getHistoryOfUser();
          setUserData(history); // Or fetching user profile
          navigate("/dashboard");
        } catch (e) {
          console.log("Check session error", e);
          // Token invalid or other error
          localStorage.removeItem("token");
          navigate("/auth");
        }
      }
    }
    checkSession();
  }, [])


  const data = {
    userData,
    setUserData,
    handleRegister,
    handleLogin,
    getHistoryOfUser,
    addToUserHistory,
    handleLogout
  };

  return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};
