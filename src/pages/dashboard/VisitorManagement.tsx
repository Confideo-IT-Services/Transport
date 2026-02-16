import { useState, useEffect } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Phone, CheckCircle2, Clock, XCircle, Search } from "lucide-react";
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
  visitor_relation: string;
  visit_reason: string;
  other_reason: string | null;
  status: string;
  teacher_approval_status: string;
  admin_approval_status: string;
  teacher_name: string | null;
  teacher_phone: string | null;
  created_at: string;
}

export default function AdminVisitorManagement() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<VisitorRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<VisitorRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, searchTerm, statusFilter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = isAdmin 
        ? await visitorRequestsApi.getAdminRequests()
        : await visitorRequestsApi.getTeacherRequests();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load visitor requests:', error);
      toast.error('Failed to load visitor requests');
    } finally {
      setIsLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = [...requests];

    if (statusFilter !== "all") {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.visitor_name.toLowerCase().includes(term) ||
        r.student_name.toLowerCase().includes(term) ||
        r.parent_name?.toLowerCase().includes(term) ||
        r.class_name.toLowerCase().includes(term)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleCallTeacher = (teacherPhone: string | null) => {
    if (!teacherPhone) {
      toast.error('Teacher phone number not available');
      return;
    }
    window.location.href = `tel:${teacherPhone}`;
  };

  const handleCallParent = (parentPhone: string) => {
    window.location.href = `tel:${parentPhone}`;
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      if (isAdmin) {
        await visitorRequestsApi.adminAccept(requestId);
        toast.success('Visitor request accepted');
      } else {
        await visitorRequestsApi.teacherAccept(requestId);
        toast.success('Visitor request accepted');
      }
      loadData();
    } catch (error: any) {
      console.error('Failed to accept request:', error);
      toast.error(error.message || 'Failed to accept visitor request');
    }
  };

  const getStatusBadge = (request: VisitorRequest) => {
    if (request.status === 'admin_accepted') {
      return <Badge className="bg-green-500">Approved</Badge>;
    }
    if (request.status === 'teacher_accepted') {
      return <Badge className="bg-blue-500">Teacher Approved</Badge>;
    }
    if (request.status === 'rejected') {
      return <Badge className="bg-red-500">Rejected</Badge>;
    }
    return <Badge className="bg-yellow-500">Pending</Badge>;
  };

  const getTeacherApprovalBadge = (request: VisitorRequest) => {
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
    <UnifiedLayout role={isAdmin ? "admin" : "teacher"}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Visitor Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage all visitor requests for the school
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by visitor, student, parent, or class..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-[200px]">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="teacher_accepted">Teacher Approved</option>
                  <option value="admin_accepted">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>Visitor Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No visitor requests found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((request) => (
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
                              <p><strong>Visitor:</strong> {request.visitor_name} ({request.visitor_relation || 'N/A'})</p>
                              <p><strong>Student:</strong> {request.student_name}</p>
                              <p><strong>Class:</strong> {request.class_name} {request.class_section ? `- ${request.class_section}` : ''}</p>
                              <p><strong>Parent:</strong> {request.parent_name || 'N/A'} ({request.parent_phone})</p>
                              <p><strong>Reason:</strong> {getReasonText(request)}</p>
                              <p><strong>Requested:</strong> {format(new Date(request.created_at), 'MMM dd, yyyy HH:mm')}</p>
                            </div>
                          </div>
                        </div>

                        {/* Teacher Approval Status - Only show for Admin */}
                        {isAdmin && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <span className="text-sm font-medium">Teacher Approval:</span>
                            {getTeacherApprovalBadge(request)}
                            {request.teacher_name && (
                              <span className="text-sm text-muted-foreground">
                                ({request.teacher_name})
                              </span>
                            )}
                          </div>
                        )}

                        {/* Action Buttons - Admin View */}
                        {isAdmin && (
                          <div className="flex gap-2 pt-2 border-t">
                            {request.teacher_phone && (
                              <Button
                                variant="outline"
                                onClick={() => handleCallTeacher(request.teacher_phone)}
                                className="flex-1"
                              >
                                <Phone className="w-4 h-4 mr-2" />
                                Call Teacher
                              </Button>
                            )}
                            {request.admin_approval_status === 'pending' && (
                              <Button
                                onClick={() => handleAcceptRequest(request.id)}
                                className="flex-1"
                                disabled={request.teacher_approval_status !== 'accepted'}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                Approve Request
                              </Button>
                            )}
                            {request.admin_approval_status === 'accepted' && (
                              <Badge className="bg-green-500">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Admin Approved
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Action Buttons - Teacher View */}
                        {!isAdmin && (
                          <div className="flex gap-2 pt-2 border-t">
                            {request.teacher_approval_status === 'pending' && (
                              <>
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
                              </>
                            )}
                            {request.teacher_approval_status === 'accepted' && (
                              <Badge className="bg-green-500">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Request Accepted
                              </Badge>
                            )}
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

