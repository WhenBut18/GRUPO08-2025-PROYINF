import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Clock, CheckCircle, XCircle, FileSignature, Download, Loader2, CircleDollarSign, PenTool, Banknote } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const API_TRAMITACION_URL = "http://localhost:8080";
const API_USUARIOS_URL = "http://localhost:8082";

const statusConfig = {
  pending: { label: "Pendiente", icon: Clock, variant: "secondary" as const },
  under_review: { label: "En Revisión", icon: FileText, variant: "default" as const },
  approved: { label: "Aprobado", icon: CheckCircle, variant: "default" as const },
  rejected: { label: "Rechazado", icon: XCircle, variant: "destructive" as const },
  signed: { label: "Firmado", icon: FileSignature, variant: "default" as const },
  payed: { label: "Desembolsado", icon: CircleDollarSign, variant: "default" as const },
};

interface Application {
  id: string;
  amount: number;
  months: number;
  monthly_payment: number;
  status: keyof typeof statusConfig;
  created_at: string;
  monthly_income?: number;
  notes?: string;
}

interface UserProfile {
  full_name: string;
  rut: string;
  address: string;
  city: string;
}

export default function Applications() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    const loadData = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const appResponse = await fetch(`${API_TRAMITACION_URL}/loan_applications?user_id=${user.id}`);
        if (appResponse.ok) {
          const apps = await appResponse.json();
          setApplications(apps.sort((a: Application, b: Application) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        } else {
          toast({ title: "Error", description: "No se pudieron cargar las solicitudes.", variant: "destructive" });
        }

        const profileResponse = await fetch(`${API_USUARIOS_URL}/users/${user.id}`);
        if (profileResponse.ok) {
          const userData = await profileResponse.json();
          if (userData.profile) {
            setProfile(userData.profile);
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
        toast({ title: "Error de red", description: "No se pudo conectar con el servidor.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user, authLoading, navigate, toast]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const handleDownloadPdf = async (app: Application) => {
    if (!profile) {
      toast({ title: "Faltan datos", description: "No se pudo cargar el perfil del usuario para generar el PDF.", variant: "destructive" });
      return;
    }
    setDownloadingId(app.id);

    await new Promise(resolve => setTimeout(resolve, 0));

    const contractElement = document.getElementById(`contract-${app.id}`);
    if (!contractElement) {
      console.error("Contract element not found for app:", app.id);
      setDownloadingId(null);
      return;
    }

    try {
      const canvas = await html2canvas(contractElement, { scale: 2, backgroundColor: null });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const contentHeight = pdfHeight > pdf.internal.pageSize.getHeight() 
        ? pdf.internal.pageSize.getHeight() - 20 
        : pdfHeight;

      pdf.addImage(imgData, "PNG", 10, 10, pdfWidth - 20, contentHeight -10);
      pdf.save(`contrato-prestamo-${app.id}.pdf`);

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error", description: "No se pudo generar el PDF.", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <p className="text-lg">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al inicio
        </Button>

        <Card className="shadow-elevated mb-6">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Mis Solicitudes
            </CardTitle>
            <CardDescription>
              Revisa el estado de tus solicitudes de préstamo
            </CardDescription>
          </CardHeader>
        </Card>

        {applications.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground mb-4">
                No tienes solicitudes aún
              </p>
              <Button onClick={() => navigate("/simulator")}>
                Simular un préstamo
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {applications.map((app) => {
              const status = statusConfig[app.status as keyof typeof statusConfig] || { label: app.status, icon: FileText, variant: "secondary" };
              const StatusIcon = status.icon;

              return (
                <Card key={app.id} className="shadow-card hover:shadow-elevated transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge variant={status.variant} className="flex items-center gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(app.created_at)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Monto</p>
                            <p className="font-bold text-lg">{formatCurrency(app.amount)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Plazo</p>
                            <p className="font-semibold">{app.months} meses</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Cuota mensual</p>
                            <p className="font-semibold text-primary">
                              {formatCurrency(app.monthly_payment)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Ingreso declarado</p>
                            <p className="font-semibold">
                              {app.monthly_income ? formatCurrency(app.monthly_income) : '-'}
                            </p>
                          </div>
                        </div>

                        {app.notes && (
                          <div className="mt-3 text-sm text-muted-foreground">
                            <p className="font-medium">Notas:</p>
                            <p>{app.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2">
                        {app.status === 'approved' && (
                          <Button onClick={() => navigate(`/firmaDigital?app=${app.id}`)} size="sm">
                            <PenTool className="w-4 h-4 mr-2" />
                            Firmar Contrato
                          </Button>
                        )}

                        {app.status === 'signed' && (
                          <>
                            <Button onClick={() => navigate(`/desembolso?app=${app.id}`)} size="sm" variant="default">
                              <Banknote className="w-4 h-4 mr-2" />
                              Desembolsar
                            </Button>
                            <Button onClick={() => handleDownloadPdf(app)} disabled={downloadingId === app.id} size="sm" variant="outline">
                              {downloadingId === app.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                              Descargar Contrato
                            </Button>
                          </>
                        )}

                        {app.status === 'payed' && (
                          <Button onClick={() => handleDownloadPdf(app)} disabled={downloadingId === app.id} size="sm" variant="outline">
                            {downloadingId === app.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                            Descargar Contrato
                          </Button>
                        )}
                      </div>

                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', background: 'white', padding: '20px', color: 'black' }}>
          {applications.filter(app => app.status === 'signed' || app.status === 'payed').map(app => (
            <div key={`contract-${app.id}`} id={`contract-${app.id}`} style={{ padding: '20px', fontFamily: 'Times New Roman, serif' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', lineHeight: '1.6' }}>
{`CONTRATO DE PRÉSTAMO DE CONSUMO DIGITAL
En Santiago de Chile, a ${new Date().toLocaleDateString('es-CL')}, comparecen:
Banco Digital, RUT 76.123.456-7, representado por don(a) __________________________, en adelante “EL BANCO”, y
don(a) ${profile?.full_name || ''}, RUT ${profile?.rut || ''}, domiciliado en ${profile?.address || '—'}, ${profile?.city || ''}, en adelante “EL CLIENTE”, quienes convienen en celebrar el siguiente contrato de préstamo de consumo:

PRIMERO: Monto y destino del préstamo
El BANCO otorga al CLIENTE un préstamo de consumo por la suma de ${formatCurrency(app.amount)}, que será abonado en la cuenta corriente N° — del CLIENTE. El dinero se destinará a fines de consumo personal.

SEGUNDO: Plazo y forma de pago
El CLIENTE se obliga a pagar el préstamo en ${app.months} cuotas mensuales y sucesivas de ${formatCurrency(app.monthly_payment)} cada una, con vencimiento el día 5 de cada mes, a partir de la fecha del desembolso. El pago se realizará mediante cargo automático en la cuenta del CLIENTE.

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
              </pre>
            </div>
          ))}
        </div>
    </div>
  );
}