import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../index.js";

const AuthContext = createContext();
export const AuthContextProvider = ({ children }) => {
  const { user, setUser } = useState([]);
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        async (event, session) => {
          console.log(event, session);
          if (session?.user == null) {
            setUser(null);
          } else {
            setUser(session?.user);
          }
        };
      },
    );

    return () => {authListener.subscription;}

  }, []);
  return (
    <AuthContext.Provider  value={{ user }}>  
      {children}

    </AuthContext.Provider>

  )



};


export const useAuth = () => {
  return useContext(AuthContext);

}
