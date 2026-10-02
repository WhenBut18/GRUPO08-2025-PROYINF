import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "@/hooks/use-toast";

interface Profile {
  full_name?: string;
  rut?: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
}

interface User {
  id: string;
  email: string;
  profile: Profile;
  created_at?: string;
  updated_at?: string;
  meta_data?: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { email: string; password: string; full_name: string; rut: string }) => Promise<void>;
  signOut: () => void;
  updateProfile: (data: Partial<Profile>) => Promise<string | null>;
}

const API_URL = "http://localhost:8082";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) setUser(JSON.parse(storedUser));
    setLoading(false);
  }, []);

  const fetchProfile = async (id: string): Promise<User> => {
    const res = await fetch(`${API_URL}/users/${id}`);
    const data = await res.json();
    // Asegurarse que profile siempre exista
    if (!data.profile) data.profile = {};
    return data;
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al iniciar sesión");

      const fullProfile = await fetchProfile(data.id);
      setUser(fullProfile);
      localStorage.setItem("user", JSON.stringify(fullProfile));

      toast({ title: "¡Bienvenido!", description: "Has iniciado sesión correctamente" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (data: { email: string; password: string; full_name: string; rut: string }) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          rut: data.rut,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        let msg = "Error al registrarse";
        if (resData.error === "email_exists") msg = "Este correo ya está registrado";
        if (resData.error === "rut_exists") msg = "El RUT ya está registrado";
        if (resData.error === "invalid_rut") msg = "RUT inválido";
        throw new Error(msg);
      }

      const fullProfile = await fetchProfile(resData.id);
      setUser(fullProfile);
      localStorage.setItem("user", JSON.stringify(fullProfile));

      toast({ title: "¡Registro exitoso!", description: "Tu cuenta ha sido creada correctamente" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("user");
    toast({ title: "Sesión cerrada", description: "Has cerrado sesión correctamente" });
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return "No hay usuario autenticado";

    try {
      const res = await fetch(`${API_URL}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok) return resData.error || "Error al actualizar perfil";

      const updatedUser = { ...user, profile: { ...user.profile, ...data } };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return null;
    } catch (err: any) {
      return String(err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};
