import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, FileSignature } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API_TRAMITACION_URL = "http://localhost:8080";
const API_USUARIOS_URL = "http://localhost:8082";

export default function FirmaDigital() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appId, setAppId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(
      Number(value || 0)
    );

  const resolveApplicationId = async (): Promise<string | null> => {
    const directId =
      searchParams.get("application") ||
      searchParams.get("app") ||
      searchParams.get("id") ||
      searchParams.get("application_id") ||
      searchParams.get("solicitud");
    if (directId) return directId;

    const simId = searchParams.get("simulation") || searchParams.get("sim");
    if (simId && user) {
      try {
        const response = await fetch(`${API_TRAMITACION_URL}/loan_applications?user_id=${user.id}&simulation_id=${simId}`);
        if (response.ok) {
          const apps = await response.json();
          if (apps && apps.length > 0) {
            return apps[0].id;
          }
        }
      } catch (err) {
        console.error("Error resolving by simulation:", err);
      }
    }

    if (user) {
      try {
        const response = await fetch(`${API_TRAMITACION_URL}/loan_applications?user_id=${user.id}&status=approved`);
        if (response.ok) {
          const apps = await response.json();
          if (apps && apps.length > 0) {
            return apps[0].id;
          }
        }
      } catch (err) {
        console.error("Error resolving latest approved application:", err);
      }
    }

    return null;
  };

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      toast({ title: "Acepta el contrato", description: "Debes aceptar las condiciones antes de firmar", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Clave inválida", description: "Ingresa tu Clave Única (mín. 6 caracteres)", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Inicia sesión", description: "Debes iniciar sesión para firmar", variant: "destructive" });
      navigate("/auth");
      return;
    }

    const resolved = appId || (await resolveApplicationId());
    if (!resolved) {
      toast({ title: "No se encontró la solicitud", description: "No pudimos determinar qué solicitud firmar", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_TRAMITACION_URL}/loan_applications/${resolved}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "signed" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "No se pudo firmar");
      }

      toast({ title: "Documento Firmado", description: "El contrato se ha firmado exitosamente." });
      
      setTimeout(() => {
        navigate("/applications");
      }, 2000);

    } catch (error: any) {
      console.error("Error signing document:", error);
      toast({ title: "No se pudo firmar", description: error.message || "Error al firmar el documento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingData(true);
      
      try {
        const resolved = await resolveApplicationId();
        setAppId(resolved);

        try {
          const profileResponse = await fetch(`${API_USUARIOS_URL}/users/${user.id}`);
          if (profileResponse.ok) {
            const userData = await profileResponse.json();
            if (userData.profile) {
              setProfile(userData.profile);
            }
          }
        } catch (err) {
          console.error("Error loading profile:", err);
        }

        if (resolved) {
          try {
            const appResponse = await fetch(`${API_TRAMITACION_URL}/loan_applications?id=${resolved}`);
            if (appResponse.ok) {
              const app = await appResponse.json();
              setApplication(app);
            }
          } catch (err) {
            console.error("Error loading application:", err);
          }
        }
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [user]);

  if (loadingData) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <p className="text-lg">Cargando documento...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button variant="ghost" onClick={() => navigate("/applications")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a mis solicitudes
        </Button>

        <Card className="shadow-elevated mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Contrato
            </CardTitle>
            <CardDescription>
              Revisa el documento de préstamo antes de firmar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-relaxed p-4 border rounded-md bg-white text-black font-serif">
{`CONTRATO DE PRÉSTAMO DE CONSUMO DIGITAL
En Santiago de Chile, a ${new Date().toLocaleDateString('es-CL')}, comparecen:
Banco Digital, RUT 76.123.456-7, representado por don(a) __________________________, en adelante “EL BANCO”, y
don(a) ${profile?.full_name || ''}, RUT ${profile?.rut || ''}, domiciliado en ${profile?.address || '—'}, ${profile?.city || ''}, en adelante “EL CLIENTE”, quienes convienen en celebrar el siguiente contrato de préstamo de consumo:

PRIMERO: Monto y destino del préstamo
El BANCO otorga al CLIENTE un préstamo de consumo por la suma de ${formatCurrency(application?.amount || 0)}, que será abonado en la cuenta corriente N° ${searchParams.get('account') || '—'} del CLIENTE. El dinero se destinará a fines de consumo personal.

SEGUNDO: Plazo y forma de pago
El CLIENTE se obliga a pagar el préstamo en ${application?.months || 0} cuotas mensuales y sucesivas de ${formatCurrency(application?.monthly_payment || 0)} cada una, con vencimiento el día 5 de cada mes, a partir de la fecha del desembolso. El pago se realizará mediante cargo automático en la cuenta del CLIENTE.

TERCERO: Intereses
El préstamo devengará un interés nominal anual del 12%, calculado sobre el saldo insoluto. El atraso en el pago de cualquier cuota generará un interés penal del 1% mensual sobre el monto adeudado.

CUARTO: Garantías
Este préstamo se otorga sin garantía específica, quedando el CLIENTE obligado al pago total del crédito conforme a las condiciones pactadas.

QUINTO: Firma digital y validez
El CLIENTE manifiesta su consentimiento mediante firma digital avanzada, realizada con autenticación por Clave Única o biometría facial, otorgando a este contrato la misma validez legal que una firma manuscrita, conforme a la Ley N°19.799 sobre Documentos Electrónicos y Firma Electrónica. El documento firmado se almacenará en la carpeta digital segura del CLIENTE y una copia será enviada a su correo electrónico.

SEXTO: Declaración final
El CLIENTE declara haber leído, comprendido y aceptado todas las condiciones del presente contrato. Ambas partes dejan constancia de que el proceso de contratación se realizó de forma 100% digital, sin intervención manual.

EL CLIENTE:
Firmado digitalmente por ${profile?.full_name || ''}
Fecha: ${new Date().toLocaleDateString('es-CL')}

EL BANCO:
Firmado digitalmente por Banco Digital
Certificado N° 000142-BANCO-2025`}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-elevated">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2">
              <FileSignature className="w-6 h-6" />
              Firma Digital
            </CardTitle>
            <CardDescription>Firma tus documentos de manera segura y 100% digital</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSign} className="space-y-4 max-w-md mx-auto">
              <div className="space-y-2">
                <Label htmlFor="clave">Clave Única</Label>
                <Input
                  id="clave"
                  type="password"
                  placeholder="Ingresa tu clave"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="accept" checked={accepted} onCheckedChange={(v) => setAccepted(Boolean(v))} />
                <Label htmlFor="accept" className="text-sm text-muted-foreground">
                  He leído y acepto las condiciones del contrato
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Confirmando..." : "Firmar documento"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}