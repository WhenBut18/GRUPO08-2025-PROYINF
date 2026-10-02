import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

const API_TRAMITACION_URL = "http://localhost:8080";
const API_VALIDACIONES_URL = "http://localhost:8081";

interface ApprovedLoan {
  id: string;
  amount: number;
  months: number;
  monthly_payment: number;
  created_at: string;
}

interface Payment {
  id: string;
  loan_application_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes: string | null;
}

export default function PayLoans() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<ApprovedLoan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLoansAndPayments();
      handleWebpayReturn();
    }
  }, [user]);

  const fetchLoansAndPayments = async () => {
    try {
      const [loansResponse, paymentsResponse] = await Promise.all([
        fetch(`${API_TRAMITACION_URL}/loan_applications?user_id=${user!.id}&status=payed,signed`),
        fetch(`${API_VALIDACIONES_URL}/payments/${user!.id}`),
      ]);

      if (!loansResponse.ok) {
        const errorData = await loansResponse.json();
        throw new Error(errorData.message || "Error al cargar préstamos");
      }

      if (!paymentsResponse.ok) {
        const errorData = await paymentsResponse.json();
        throw new Error(errorData.message || "Error al cargar pagos");
      }

      const loansData = await loansResponse.json();
      const paymentsData = await paymentsResponse.json();

      setLoans(loansData || []);
      setPayments(paymentsData || []);
    } catch (error: any) {
      console.error("Error fetching loans and payments:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWebpayPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLoan) {
      toast({
        title: "Error",
        description: "Por favor selecciona un préstamo",
        variant: "destructive",
      });
      return;
    }

    const selectedLoanData = loans.find(l => l.id === selectedLoan);
    if (!selectedLoanData) return;

    const paymentCount = getPaymentCount(selectedLoan);
    if (paymentCount >= selectedLoanData.months) {
      toast({
        title: "Error",
        description: "Ya has pagado todas las cuotas de este préstamo",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_TRAMITACION_URL}/initiate_webpay_payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loan_application_id: selectedLoan,
          user_id: user!.id,
          amount: selectedLoanData.monthly_payment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al iniciar pago con Webpay");
      }

      const data = await response.json()

      const form = document.createElement("form")
      form.metthod = "POST"
      form.action = data.url

      const input = document.createElement("input")
      input.type = "hidden"
      input.name = "token_ws"
      input.value = data.token

      // 3. Lo inyectamos al DOM, enviamos la petición a Transbank y limpiamos
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);



      // El servidor devuelve HTML con formulario que se auto-envía a Transbank
      // const html = await response.text();
      // document.open();
      // document.write(html);
      // document.close();
    } catch (error: any) {
      console.error("Error initiating Webpay payment:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo iniciar el pago con Webpay",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const handleWebpayReturn = async () => {
    const params = new URLSearchParams(window.location.search);
    const token_ws = params.get("token_ws");
    const buyOrder = params.get("buyOrder");

    if (!token_ws) return;

    try {
      const response = await fetch(`${API_TRAMITACION_URL}/webpay_callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_ws,
          buyOrder,
        }),
      });

      const result = await response.json();

      if (result.success) {
      
        toast({
          title: "¡Éxito!",
          description: "Cuota pagada exitosamente",
        });
        setSelectedLoan("");
        fetchLoansAndPayments();
      } else {
        toast({
          title: "Pago rechazado",
          description: result.message || "El banco rechazó la transacción",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error procesando retorno de Webpay:", error);
      toast({
        title: "Error",
        description: "Error procesando el resultado del pago",
        variant: "destructive",
      });
    }
  };

  const getPaymentCount = (loanId: string) => {
    return payments.filter((p) => p.loan_application_id === loanId).length;
  };

  const getTotalPaid = (loanId: string) => {
    return payments
      .filter((p) => p.loan_application_id === loanId)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Pagar Préstamos</h1>
            <p className="text-muted-foreground">
              Gestiona los pagos de tus préstamos aprobados
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Formulario de pago */}
          <Card>
            <CardHeader>
              <CardTitle>Registrar Pago</CardTitle>
              <CardDescription>
                Ingresa los detalles de tu pago
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleWebpayPayment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loan">Préstamo</Label>
                  <Select
                    value={selectedLoan}
                    onValueChange={setSelectedLoan}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un préstamo" />
                    </SelectTrigger>
                    <SelectContent>
                      {loans.map((loan) => {
                        const paidCount = getPaymentCount(loan.id);
                        const isCompleted = paidCount >= loan.months;
                        return (
                          <SelectItem
                            key={loan.id}
                            value={loan.id}
                            disabled={isCompleted}
                          >
                            ${loan.amount.toLocaleString()} - Cuota {paidCount < loan.months ? paidCount + 1 : paidCount} de {loan.months}
                            {isCompleted && " (Completado)"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {selectedLoan && (() => {
                  const loan = loans.find(l => l.id === selectedLoan);
                  const paidCount = getPaymentCount(selectedLoan);
                  if (!loan) return null;
                  return (
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Cuota a pagar:</span>
                        <span className="font-semibold">Cuota {paidCount < loan.months ? paidCount + 1 : paidCount} del {loan.months}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Monto de la cuota:</span>
                        <span className="font-semibold">${Number(loan.monthly_payment).toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}

                <Button type="submit" className="w-full" disabled={submitting || !selectedLoan}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirigiendo a Webpay...
                    </>
                  ) : (
                    "Pagar con Webpay"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Lista de préstamos aprobados */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Préstamos Aprobados</h2>
            {loans.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No tienes préstamos aprobados
                  </p>
                </CardContent>
              </Card>
            ) : (
              loans.map((loan) => {
                const paidCount = getPaymentCount(loan.id);
                const remainingPayments = loan.months - paidCount;
                const progress = (paidCount / loan.months) * 100;
                const isCompleted = paidCount >= loan.months;

                return (
                  <Card key={loan.id}>
                    <CardHeader>
                      <CardTitle className="text-xl">
                        ${Number(loan.amount).toLocaleString()}
                      </CardTitle>
                      <CardDescription>
                        {loan.months} cuotas - $
                        {Number(loan.monthly_payment).toLocaleString()}/cuota
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cuotas pagadas:</span>
                        <span className="font-medium">
                          {paidCount} de {loan.months}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cuotas restantes:</span>
                        <span className="font-medium">
                          {remainingPayments}
                        </span>
                      </div>
                      {!isCompleted && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Próxima cuota:</span>
                          <span className="font-medium">
                            ${Number(loan.monthly_payment).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        {isCompleted ? "✓ Completado" : `${progress.toFixed(1)}% completado`}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Historial de pagos */}
        {payments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Historial de Pagos</CardTitle>
              <CardDescription>
                Todos tus pagos registrados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center border-b pb-4 last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        ${Number(payment.amount).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.payment_method} -{" "}
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </p>
                      {payment.notes && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {payment.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}