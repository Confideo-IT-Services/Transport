import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { visitorRequestsApi } from "@/lib/api";
import { format } from "date-fns";

interface VisitorRequest {
  id: string;
  student_id: string;
  student_name: string;
  parent_name: string | null;
  parent_phone: string;
  class_name: string;
  class_section: string;
  visitor_name: string;
  visit_reason: string;
  other_reason: string | null;
  status: string;
  teacher_approval_status: string;
  created_at: string;
}

export default function TeacherVisitorManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await visitorRequestsApi.getTeacherRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load visitor requests:', error);
      toast.error('Failed to load visitor requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallParent = (parentPhone: string) => {
    window.location.href = `tel:${parentPhone}`;
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await visitorRequestsApi.teacherAccept(requestId);
      toast.success('Visitor request accepted');
      loadData();
    } catch (error: any) {
      console.error('Failed to accept request:', error);
      toast.error(error.message || 'Failed to accept visitor request');
    }
  };

  const getStatusBadge = (request: VisitorRequest) => {
    if (request.teacher_approval_status === 'accepted') {
      return <Badge className="bg-green-500">Accepted</Badge>;
    }
    return <Badge className="bg-yellow-500">Pending</Badge>;
  };

  const getReasonText = (request: VisitorRequest) => {
    if (request.visit_reason === 'other') {
      return request.other_reason || 'Other';
    }
    return request.visit_reason.charAt(0).toUpperCase() + request.visit_reason.slice(1);
  };

  return (
    <UnifiedLayout role="teacher">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visitor Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage visitor requests for your class
          </p>
        </div>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>Visitor Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No visitor requests at the moment
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-lg">{request.visitor_name}</span>
                              {getStatusBadge(request)}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p><strong>Student:</strong> {request.student_name}</p>
                              <p><strong>Class:</strong> {request.class_name} {request.class_section ? `- ${request.class_section}` : ''}</p>
                              <p><strong>Parent:</strong> {request.parent_name || 'N/A'} ({request.parent_phone})</p>
                              <p><strong>Reason:</strong> {getReasonText(request)}</p>
                              <p><strong>Requested:</strong> {format(new Date(request.created_at), 'MMM dd, yyyy HH:mm')}</p>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {request.teacher_approval_status === 'pending' && (
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              variant="outline"
                              onClick={() => handleCallParent(request.parent_phone)}
                              className="flex-1"
                            >
                              <Phone className="w-4 h-4 mr-2" />
                              Call to Confirm
                            </Button>
                            <Button
                              onClick={() => handleAcceptRequest(request.id)}
                              className="flex-1"
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              Request Accepted
                            </Button>
                          </div>
                        )}

                        {request.teacher_approval_status === 'accepted' && (
                          <div className="pt-2 border-t">
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Request Accepted
                            </Badge>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UnifiedLayout>
  );
}



