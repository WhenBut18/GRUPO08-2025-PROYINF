import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Banknote, Building, CreditCard, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API_TRAMITACION_URL = "http://localhost:8080";

export default function Desembolso() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    banco: "",
    tipoCuenta: "Cuenta Corriente",
    numeroCuenta: "",
    rut: "",
    correo: ""
  });

  const appId = searchParams.get("app");

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appId) {
      toast({ title: "Error", description: "No se identificó la solicitud.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_TRAMITACION_URL}/loan_applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: "payed", 
          notes: `Transferencia a ${formData.banco}, Cuenta: ${formData.numeroCuenta}`
        }),
      });

      if (!response.ok) {
        throw new Error("No se pudo registrar el desembolso");
      }

      toast({ 
        title: "Desembolso exitoso", 
        description: "El dinero ha sido transferido a su cuenta bancaria." 
      });
      
      setTimeout(() => {
        navigate("/applications");
      }, 2000);

    } catch (error: any) {
      console.error("Error al desembolsar:", error);
      toast({ title: "Fallo al desembolsar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero py-8">
      <div className="container mx-auto px-4 max-w-xl">
        <Button variant="ghost" onClick={() => navigate("/applications")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a mis solicitudes
        </Button>

        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <Banknote className="w-6 h-6 text-primary" />
              Datos de Desembolso
            </CardTitle>
            <CardDescription>
              Ingresa los datos de tu cuenta bancaria para recibir tu préstamo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="rut">RUT Titular</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rut"
                    name="rut"
                    placeholder="12.345.678-9"
                    value={formData.rut}
                    onChange={handleChange}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <select
                    id="banco"
                    name="banco"
                    value={formData.banco}
                    onChange={handleChange}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    required
                  >
                    <option value="" disabled>Selecciona un banco</option>
                    <option value="BancoEstado">BancoEstado</option>
                    <option value="Banco de Chile">Banco de Chile</option>
                    <option value="BCI">Banco BCI</option>
                    <option value="Santander">Banco Santander</option>
                    <option value="Itaú">Banco Itaú</option>
                    <option value="Scotiabank">Scotiabank</option>
                    <option value="Falabella">Banco Falabella</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipoCuenta">Tipo de Cuenta</Label>
                <select
                  id="tipoCuenta"
                  name="tipoCuenta"
                  value={formData.tipoCuenta}
                  onChange={handleChange}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  required
                >
                  <option value="Cuenta Corriente">Cuenta Corriente</option>
                  <option value="Cuenta Vista">Cuenta Vista</option>
                  <option value="Cuenta RUT">Cuenta RUT</option>
                  <option value="Cuenta de Ahorro">Cuenta de Ahorro</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="numeroCuenta">Número de Cuenta</Label>
                <Input
                  id="numeroCuenta"
                  name="numeroCuenta"
                  type="number"
                  placeholder="Ej: 123456789"
                  value={formData.numeroCuenta}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="correo">Correo Electrónico (Comprobante)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="correo"
                    name="correo"
                    type="email"
                    placeholder="tu@correo.cl"
                    value={formData.correo}
                    onChange={handleChange}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full mt-6" disabled={loading}>
                {loading ? "Procesando..." : "Confirmar y Desembolsar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}