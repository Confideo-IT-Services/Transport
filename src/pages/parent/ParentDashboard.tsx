import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { parentsApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Download, FileText, CheckCircle2, Calendar, Clock, BookOpen } from "lucide-react";
import { format } from "date-fns";
import { getTodayISTString, formatInIST, formatDateOnlyIST } from "@/lib/date-ist";
import jsPDF from 'jspdf';

/** YYYY-MM-DD for parent homework filter (assignment date); stable for DB timestamp strings. */
function homeworkAssignedDayKey(hw: any): string | null {
  const raw = hw.createdAt ?? hw.created_at;
  if (raw == null || raw === "") return null;
  if (typeof raw === "string") {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw.trim());
    if (m) return m[1];
  }
  const d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d.getTime())) return null;
  return formatDateOnlyIST(d);
}
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { SkeletonList, SkeletonCard } from "@/components/ui/skeleton";

export default function ParentDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get current section from URL
  const currentSection = location.pathname.split('/').pop() || 'attendance';

  useEffect(() => {
    loadChildren();
  }, []);

  // Redirect to attendance if on base dashboard
  useEffect(() => {
    if (location.pathname === '/parent/dashboard') {
      navigate('/parent/dashboard/attendance', { replace: true });
    }
  }, [location.pathname, navigate]);

  const loadChildren = async () => {
    try {
      console.log('Loading children for parent...');
      const data = await parentsApi.getChildren();
      console.log('Children loaded:', data);
      setChildren(data);
      if (data.length > 0) {
        setSelectedChild(data[0].id);
      } else {
        console.warn('No children found for parent');
      }
    } catch (error) {
      console.error('Failed to load children:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load children';
      toast.error(errorMessage + ' Please refresh the page or contact support if the issue persists.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <UnifiedLayout role="parent">
        <div className="space-y-6">
          <div>
            <SkeletonCard />
          </div>
          <SkeletonList items={3} />
        </div>
      </UnifiedLayout>
    );
  }

  return (
    <UnifiedLayout role="parent">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Parent Portal</h1>
          <p className="text-muted-foreground mt-1">
            Welcome, {user?.name || 'Parent'}! View your child's information below.
          </p>
        </div>
        
        {children.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                No children found. Please contact the school if you believe this is an error.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Child Selector */}
            {children.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Child</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {children.map((child) => (
                      <Button
                        key={child.id}
                        variant={selectedChild === child.id ? "default" : "outline"}
                        onClick={() => setSelectedChild(child.id)}
                        className="flex items-center gap-2"
                        title={child.schoolName ? `${child.name} - ${child.schoolName}` : child.name}
                      >
                        <User className="w-4 h-4" />
                        {child.name} - {child.className}
                        {child.schoolName && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            {child.schoolName}
                          </Badge>
                        )}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Child Details - Show based on current section */}
            {selectedChild && (
              <ChildDetails 
                studentId={selectedChild} 
                section={currentSection}
                childInfo={children.find(c => c.id === selectedChild)}
              />
            )}
          </>
        )}
      </div>
    </UnifiedLayout>
  );
}

function ChildDetails({ 
  studentId, 
  section,
  childInfo 
}: { 
  studentId: string; 
  section: string;
  childInfo?: any;
}) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testDetail, setTestDetail] = useState<any | null>(null);
  const [showTestDetail, setShowTestDetail] = useState(false);
  const [loadingTestDetail, setLoadingTestDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Date filter states - default to today
  const today = getTodayISTString();
  const [attendanceStartDate, setAttendanceStartDate] = useState<string>(today);
  const [attendanceEndDate, setAttendanceEndDate] = useState<string>(today);
  const [homeworkStartDate, setHomeworkStartDate] = useState<string>(today);
  const [homeworkEndDate, setHomeworkEndDate] = useState<string>(today);

  useEffect(() => {
    loadData();
  }, [studentId, attendanceStartDate, attendanceEndDate, homeworkStartDate, homeworkEndDate]);

  useEffect(() => {
    if (studentId && section === 'results') {
      loadTests();
    }
  }, [studentId, section]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading data for student:', studentId);
      const [attData, hwData, notifData, feesData, resultsData] = await Promise.all([
        parentsApi.getChildAttendance(studentId, attendanceStartDate, attendanceEndDate).catch((err) => {
          console.error('Failed to load attendance:', err);
          return [];
        }),
        parentsApi.getChildHomework(studentId).catch((err) => {
          console.error('Failed to load homework:', err);
          return [];
        }),
        parentsApi.getChildNotifications(studentId).catch((err) => {
          console.error('Failed to load notifications:', err);
          return [];
        }),
        parentsApi.getChildFees(studentId).catch((err) => {
          console.error('Failed to load fees:', err);
          return [];
        }),
        parentsApi.getChildTestResults(studentId).catch((err) => {
          console.error('Failed to load test results:', err);
          return [];
        }),
      ]);
      
      // Filter homework by assignment date (createdAt), not due date — "today" shows work assigned today
      const filteredHomework = hwData.filter((hw: any) => {
        if (!homeworkStartDate && !homeworkEndDate) return true;

        const assignedDayStr = homeworkAssignedDayKey(hw);
        if (!assignedDayStr) return true;

        const start = homeworkStartDate || "1900-01-01";
        const end = homeworkEndDate || "9999-12-31";

        return assignedDayStr >= start && assignedDayStr <= end;
      });
      
      console.log('Data loaded:', {
        attendance: attData.length,
        homework: filteredHomework.length,
        notifications: notifData.length,
        fees: feesData.length,
        testResults: resultsData.length
      });
      setAttendance(attData);
      setHomework(filteredHomework);
      setNotifications(notifData);
      setFees(feesData);
      setTestResults(resultsData);
    } catch (error) {
      console.error('Failed to load child data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      toast.error(errorMessage + ' Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadTests = async () => {
    if (!studentId) return;
    try {
      setLoadingTests(true);
      const data = await parentsApi.getChildTests(studentId);
      setTests(data);
    } catch (error) {
      console.error('Failed to load tests:', error);
      setTests([]);
    } finally {
      setLoadingTests(false);
    }
  };

  const loadTestDetail = async (testId: string) => {
    if (!studentId) return;
    try {
      setLoadingTestDetail(true);
      const data = await parentsApi.getChildTestDetails(studentId, testId);
      setTestDetail(data);
      setShowTestDetail(true);
    } catch (error) {
      console.error('Failed to load test details:', error);
      toast.error('Failed to load test details');
    } finally {
      setLoadingTestDetail(false);
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await parentsApi.markNotificationRead(notificationId);
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      toast.error('Failed to mark notification as read. Please try again.');
    }
  };

  const handleDownloadReceipt = async (fee: any) => {
    if (!childInfo) return;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fee Receipt - ${childInfo.name}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 600px;
      margin: 2rem auto;
      padding: 1rem;
      background: #fff;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
      border-bottom: 2px solid #333;
      padding-bottom: 1rem;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0;
      color: #333;
    }
    .subtitle {
      font-size: 0.875rem;
      color: #666;
      margin-top: 0.5rem;
    }
    .student-info {
      background: #f5f5f5;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
    }
    .student-info p {
      margin: 0.25rem 0;
      font-size: 0.875rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      font-weight: 600;
      background: #f9f9f9;
      color: #333;
    }
    .component-table {
      margin-top: 1rem;
    }
    .component-table th {
      font-size: 0.875rem;
      font-weight: 500;
    }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #ddd;
      font-size: 0.75rem;
      color: #666;
      text-align: center;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-paid { background: #d4edda; color: #155724; }
    .status-partial { background: #fff3cd; color: #856404; }
    .status-unpaid { background: #f8d7da; color: #721c24; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Fee Receipt / Invoice</h1>
    <div class="subtitle">${childInfo.schoolName || 'School'}</div>
  </div>
  
  <div class="student-info">
    <p><strong>Student Name:</strong> ${childInfo.name || "-"}</p>
    <p><strong>Roll No:</strong> ${childInfo.rollNo || "-"}</p>
    <p><strong>Class:</strong> ${childInfo.className || "-"}</p>
    ${childInfo.admissionNumber ? `<p><strong>Admission No:</strong> ${childInfo.admissionNumber}</p>` : ''}
  </div>
  
  <table>
    <tr>
      <th>Total Fee</th>
      <td>₹${(fee.totalFee ?? 0).toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <th>Paid Amount</th>
      <td>₹${(fee.paidAmount ?? 0).toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <th>Pending Amount</th>
      <td>₹${(fee.pendingAmount ?? 0).toLocaleString('en-IN')}</td>
    </tr>
    <tr>
      <th>Status</th>
      <td>
        <span class="status-badge status-${fee.status || 'unpaid'}">
          ${(fee.status || 'unpaid').charAt(0).toUpperCase() + (fee.status || 'unpaid').slice(1)}
        </span>
      </td>
    </tr>
    ${fee.dueDate ? `
    <tr>
      <th>Due Date</th>
      <td>${new Date(fee.dueDate).toLocaleDateString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}</td>
    </tr>
    ` : ''}
  </table>
  
  ${fee.componentBreakdown ? `
  <h3 style="margin-top: 1.5rem; font-size: 1rem;">Component Breakdown</h3>
  <table class="component-table">
    <thead>
      <tr>
        <th>Component</th>
        <th>Total</th>
        <th>Paid</th>
        <th>Pending</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(fee.componentBreakdown).map(([key, value]: [string, any]) => `
        <tr>
          <td>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</td>
          <td>₹${(value.total || 0).toLocaleString('en-IN')}</td>
          <td>₹${(value.paid || 0).toLocaleString('en-IN')}</td>
          <td>₹${(value.pending || 0).toLocaleString('en-IN')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}
  
  <div class="footer">
    Generated on ${formatInIST(new Date(), { dateStyle: "medium", timeStyle: "short" })} · ConventPulse
  </div>
</body>
</html>`;

    try {
      // Create a temporary container
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '600px';
      document.body.appendChild(container);

      // Convert to canvas then PDF
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Remove temporary container
      document.body.removeChild(container);

      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // Download PDF
      const fileName = `Fee_Receipt_${childInfo.name.replace(/\s+/g, '_')}_${getTodayISTString().replace(/-/g, '')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({
        title: "Error",
        description: "Failed to download receipt. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading child data...</div>;
  }

  // Render content based on section
  const renderContent = () => {
    switch (section) {
      case 'attendance':
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Attendance Records</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="date"
                    value={attendanceStartDate}
                    onChange={(e) => setAttendanceStartDate(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={attendanceEndDate}
                    onChange={(e) => setAttendanceEndDate(e.target.value)}
                    className="w-40"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = getTodayISTString();
                      setAttendanceStartDate(today);
                      setAttendanceEndDate(today);
                    }}
                  >
                    Today
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No attendance records found for selected date range.
                </p>
              ) : (
                <div className="space-y-2">
                  {attendance.map((a) => (
                    <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="font-medium">{new Date(a.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</p>
                        {a.remarks && (
                          <p className="text-sm text-muted-foreground mt-1">{a.remarks}</p>
                        )}
                      </div>
                      <Badge 
                        variant={a.status === 'present' ? 'default' : a.status === 'absent' ? 'destructive' : 'secondary'}
                      >
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'homework':
        return (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle>Homework Assignments</CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="date"
                    value={homeworkStartDate}
                    onChange={(e) => setHomeworkStartDate(e.target.value)}
                    className="w-40"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={homeworkEndDate}
                    onChange={(e) => setHomeworkEndDate(e.target.value)}
                    className="w-40"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = getTodayISTString();
                      setHomeworkStartDate(today);
                      setHomeworkEndDate(today);
                    }}
                  >
                    Today
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {homework.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No homework assigned for selected date range.
                </p>
              ) : (
                <div className="space-y-4">
                  {homework.map((hw) => (
                    <div key={hw.id} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{hw.title}</h4>
                            {hw.isCompleted && (
                              <Badge variant="default" className="text-xs">Completed</Badge>
                            )}
                          </div>
                          {hw.subject && (
                            <Badge variant="outline" className="mb-2">{hw.subject}</Badge>
                          )}
                          <p className="text-sm text-muted-foreground mt-2">{hw.description}</p>
                          {hw.dueDate && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Due: {new Date(hw.dueDate).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </p>
                          )}
                          {hw.createdAt && (
                            <p className="text-xs text-muted-foreground">
                              Assigned: {new Date(hw.createdAt).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </p>
                          )}
                          {hw.attachmentUrl && (
                            <a 
                              href={hw.attachmentUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline mt-2 inline-block"
                            >
                              View Attachment →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'notifications':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No notifications.</p>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-4 border rounded-lg transition-colors ${
                        !notif.isRead ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{notif.title}</h4>
                            {!notif.isRead && (
                              <Badge variant="destructive" className="text-xs">New</Badge>
                            )}
                            {notif.priority === 'urgent' && (
                              <Badge variant="destructive" className="text-xs">Urgent</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{notif.message}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-xs text-muted-foreground">
                              From: {notif.senderName} ({notif.senderRole})
                            </p>
                            <span className="text-xs text-muted-foreground">•</span>
                            <p className="text-xs text-muted-foreground">
                              {formatInIST(new Date(notif.createdAt), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {notif.attachmentUrl && (
                            <a 
                              href={notif.attachmentUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline mt-2 inline-block"
                            >
                              View Attachment →
                            </a>
                          )}
                        </div>
                        {!notif.isRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkNotificationRead(notif.id)}
                          >
                            Mark Read
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'fees':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Fee Records</CardTitle>
            </CardHeader>
            <CardContent>
              {fees.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No fee records found.</p>
              ) : (
                <div className="space-y-4">
                  {fees.map((fee) => (
                    <div key={fee.id} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium">Fee Record</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant={fee.status === 'paid' ? 'default' : fee.status === 'partial' ? 'secondary' : 'destructive'}>
                            {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadReceipt(fee)}
                            className="flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download Receipt
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Total Fee</p>
                          <p className="text-lg font-semibold">₹{fee.totalFee.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Paid</p>
                          <p className="text-lg font-semibold text-green-600">₹{fee.paidAmount.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Pending</p>
                          <p className="text-lg font-semibold text-red-600">₹{fee.pendingAmount.toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                      {fee.dueDate && (
                        <p className="text-sm text-muted-foreground">
                          Due Date: {new Date(fee.dueDate).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      )}
                      {fee.componentBreakdown && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm font-medium mb-2">Component Breakdown:</p>
                          <div className="space-y-1">
                            {Object.entries(fee.componentBreakdown).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex justify-between text-sm">
                                <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                                <span>₹{value.pending?.toLocaleString('en-IN') || 0} pending</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      case 'results':
        return (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Tests & Results</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="tests" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="tests">
                      <FileText className="w-4 h-4 mr-2" />
                      Tests
                    </TabsTrigger>
                    <TabsTrigger value="results">
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Test Results
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tests" className="space-y-4 mt-4">
                    {loadingTests ? (
                      <SkeletonList items={3} />
                    ) : tests.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No tests found.</p>
                    ) : (
                      <div className="space-y-3">
                        {tests.map((test) => (
                          <div
                            key={test.id}
                            className="p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => loadTestDetail(test.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{test.name}</h4>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    {new Date(test.testDate).toLocaleDateString('en-US', { 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                  {test.testTime && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-4 h-4" />
                                      {test.testTime}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-4 h-4" />
                                    {test.className}
                                  </span>
                                </div>
                                <Badge variant="secondary" className="mt-2">
                                  {test.subjectCount} Subjects
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="results" className="space-y-4 mt-4">
                    {testResults.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">No test results found.</p>
                    ) : (
                      <div className="space-y-4">
                        {testResults.map((result) => (
                          <div key={result.id} className="p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium">{result.testName}</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {result.subjectName} ({result.subjectCode})
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Date: {new Date(result.testDate).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-2xl font-bold">
                                  {result.marksObtained} / {result.maxMarks}
                                </p>
                                <p className="text-sm font-medium text-primary">
                                  {result.percentage}%
                                </p>
                                <Badge 
                                  variant={
                                    parseFloat(result.percentage) >= 80 ? 'default' : 
                                    parseFloat(result.percentage) >= 60 ? 'secondary' : 
                                    'destructive'
                                  }
                                  className="mt-1"
                                >
                                  {parseFloat(result.percentage) >= 80 ? 'Excellent' : 
                                   parseFloat(result.percentage) >= 60 ? 'Good' : 
                                   'Needs Improvement'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Test Detail Modal */}
            {showTestDetail && testDetail && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{testDetail.name}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setShowTestDetail(false)}>
                      ✕
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Test Date</p>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(testDetail.testDate).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                      {testDetail.testTime && (
                        <div>
                          <p className="text-sm text-muted-foreground">Test Time</p>
                          <p className="font-medium flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {testDetail.testTime}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-muted-foreground">Class</p>
                        <p className="font-medium flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          {testDetail.className}
                        </p>
                      </div>
                    </div>

                    <Tabs defaultValue="syllabus" className="w-full">
                      <TabsList>
                        <TabsTrigger value="syllabus">
                          <FileText className="w-4 h-4 mr-2" />
                          Syllabus
                        </TabsTrigger>
                        <TabsTrigger value="results">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Results
                          {testDetail.results.length > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {testDetail.results.length}
                            </Badge>
                          )}
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="syllabus" className="space-y-3 mt-4">
                        {testDetail.subjects.map((subject: any) => (
                          <Card key={subject.id} className="border-l-4 border-l-primary">
                            <CardContent className="pt-4">
                              <h4 className="font-semibold">{subject.subjectName}</h4>
                              <p className="text-sm text-muted-foreground">
                                {subject.subjectCode} • Max Marks: {subject.maxMarks}
                              </p>
                              {subject.syllabus && (
                                <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                                  <p className="text-sm font-medium mb-1">Syllabus:</p>
                                  <p className="text-sm whitespace-pre-wrap">{subject.syllabus}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </TabsContent>

                      <TabsContent value="results" className="space-y-3 mt-4">
                        {testDetail.results.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">Results not available yet.</p>
                        ) : (
                          testDetail.results.map((result: any) => {
                            const percentage = parseFloat(result.percentage);
                            return (
                              <Card key={result.id}>
                                <CardContent className="pt-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h4 className="font-semibold">{result.subjectName}</h4>
                                      <p className="text-sm text-muted-foreground">{result.subjectCode}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-2xl font-bold">
                                        {result.marksObtained} / {result.maxMarks}
                                      </p>
                                      <p className="text-sm font-medium text-primary">
                                        {result.percentage}%
                                      </p>
                                      <Badge
                                        variant={
                                          percentage >= 80 ? 'default' :
                                          percentage >= 60 ? 'secondary' :
                                          'destructive'
                                        }
                                        className="mt-1"
                                      >
                                        {percentage >= 80 ? 'Excellent' :
                                         percentage >= 60 ? 'Good' :
                                         'Needs Improvement'}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        );

      default:
        return (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Section not found.</p>
            </CardContent>
          </Card>
        );
    }
  };

  return renderContent();
}
