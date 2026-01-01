import { useState } from "react";
import { UnifiedLayout } from "@/components/layout/UnifiedLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  IndianRupee, 
  Plus, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  Bell,
  Search,
  Eye
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const feeCategories = [
  { id: 1, name: "Tuition Fee", amount: 15000, frequency: "Quarterly" },
  { id: 2, name: "Transport Fee", amount: 3000, frequency: "Monthly" },
  { id: 3, name: "Lab Fee", amount: 2000, frequency: "Yearly" },
  { id: 4, name: "Sports Fee", amount: 1500, frequency: "Yearly" },
  { id: 5, name: "Library Fee", amount: 500, frequency: "Yearly" },
];

const classFeeStructure = [
  { class: "Class 1-2", tuition: 12000, transport: 2500, lab: 0, total: 14500 },
  { class: "Class 3-5", tuition: 15000, transport: 3000, lab: 2000, total: 20000 },
  { class: "Class 6-8", tuition: 18000, transport: 3000, lab: 3000, total: 24000 },
  { class: "Class 9-10", tuition: 22000, transport: 3500, lab: 4000, total: 29500 },
];

const studentFees = [
  { id: 1, name: "Aarav Sharma", rollNo: 1, class: "5A", totalFee: 20000, paid: 20000, pending: 0, status: "paid" },
  { id: 2, name: "Ananya Patel", rollNo: 2, class: "5A", totalFee: 20000, paid: 15000, pending: 5000, status: "partial" },
  { id: 3, name: "Arjun Kumar", rollNo: 3, class: "5A", totalFee: 20000, paid: 0, pending: 20000, status: "unpaid" },
  { id: 4, name: "Diya Singh", rollNo: 4, class: "5A", totalFee: 20000, paid: 20000, pending: 0, status: "paid" },
  { id: 5, name: "Ishaan Gupta", rollNo: 5, class: "5A", totalFee: 20000, paid: 10000, pending: 10000, status: "partial" },
  { id: 6, name: "Kavya Reddy", rollNo: 6, class: "5A", totalFee: 20000, paid: 20000, pending: 0, status: "paid" },
  { id: 7, name: "Lakshmi Nair", rollNo: 7, class: "5A", totalFee: 20000, paid: 5000, pending: 15000, status: "partial" },
  { id: 8, name: "Manav Joshi", rollNo: 8, class: "5A", totalFee: 20000, paid: 0, pending: 20000, status: "unpaid" },
];

export default function FeesModule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";
  const [selectedClass, setSelectedClass] = useState("5A");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredStudents = studentFees.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.rollNo.toString().includes(searchTerm)
  );

  const totalCollected = studentFees.reduce((sum, s) => sum + s.paid, 0);
  const totalPending = studentFees.reduce((sum, s) => sum + s.pending, 0);
  const paidCount = studentFees.filter(s => s.status === "paid").length;
  const unpaidCount = studentFees.filter(s => s.status === "unpaid").length;

  const sendReminder = (studentName: string) => {
    toast({
      title: "Reminder Sent",
      description: `Fee reminder sent to ${studentName}'s parents.`,
    });
  };

  return (
    <UnifiedLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Fee Management</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin 
                ? "Manage fee structure and track payments"
                : "View student fee status (Read-only)"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isAdmin && (
              <Badge variant="secondary" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                View Only
              </Badge>
            )}
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <IndianRupee className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{totalCollected.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Collected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">₹{totalPending.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{paidCount}</p>
                  <p className="text-sm text-muted-foreground">Fully Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{unpaidCount}</p>
                  <p className="text-sm text-muted-foreground">Unpaid</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="students" className="space-y-6">
          <TabsList>
            <TabsTrigger value="students">Student Fees</TabsTrigger>
            {isAdmin && <TabsTrigger value="structure">Fee Structure</TabsTrigger>}
            {isAdmin && <TabsTrigger value="categories">Fee Categories</TabsTrigger>}
          </TabsList>

          {/* Student Fees */}
          <TabsContent value="students" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Student Fee Status</CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name or roll no..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5A">Class 5A</SelectItem>
                        <SelectItem value="5B">Class 5B</SelectItem>
                        <SelectItem value="4A">Class 4A</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Total Fee</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Pending</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>{student.rollNo}</TableCell>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>₹{student.totalFee.toLocaleString()}</TableCell>
                        <TableCell className="text-secondary">₹{student.paid.toLocaleString()}</TableCell>
                        <TableCell className={student.pending > 0 ? "text-destructive" : ""}>
                          ₹{student.pending.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={
                              student.status === "paid" ? "bg-secondary" : 
                              student.status === "partial" ? "bg-accent" : "bg-destructive"
                            }
                          >
                            {student.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {student.pending > 0 && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => sendReminder(student.name)}
                              >
                                <Bell className="w-4 h-4 mr-1" />
                                Remind
                              </Button>
                            )}
                            {isAdmin && (
                              <Button size="sm" variant="ghost">View</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fee Structure (Admin Only) */}
          {isAdmin && (
            <TabsContent value="structure" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Class-wise Fee Structure</h2>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Edit Structure
                </Button>
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class Range</TableHead>
                      <TableHead>Tuition (Quarterly)</TableHead>
                      <TableHead>Transport (Monthly)</TableHead>
                      <TableHead>Lab (Yearly)</TableHead>
                      <TableHead>Total (Quarterly)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classFeeStructure.map((fee, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{fee.class}</TableCell>
                        <TableCell>₹{fee.tuition.toLocaleString()}</TableCell>
                        <TableCell>₹{fee.transport.toLocaleString()}</TableCell>
                        <TableCell>₹{fee.lab.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">₹{fee.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          )}

          {/* Fee Categories (Admin Only) */}
          {isAdmin && (
            <TabsContent value="categories" className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Fee Categories</h2>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Fee Category</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category Name</label>
                        <Input placeholder="e.g., Exam Fee" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Amount (₹)</label>
                        <Input type="number" placeholder="Enter amount" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Frequency</label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="quarterly">Quarterly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button className="w-full">Add Category</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {feeCategories.map((category) => (
                  <Card key={category.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{category.name}</h3>
                          <p className="text-2xl font-bold mt-2">₹{category.amount.toLocaleString()}</p>
                          <Badge variant="outline" className="mt-2">{category.frequency}</Badge>
                        </div>
                        <Button variant="ghost" size="sm">Edit</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </UnifiedLayout>
  );
}
