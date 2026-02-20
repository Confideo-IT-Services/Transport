import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, GraduationCap, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { academicYearsApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Student {
  studentId: string;
  name: string;
  rollNo: string | null;
  yearlyPercentage: number;
  hasResults: boolean;
  tcIssued: boolean;
}

interface PromoteStudentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromAcademicYearId: string;
  fromAcademicYearName: string;
  toAcademicYearId: string;
  toAcademicYearName: string;
  classId: string;
  className: string;
  onSuccess: () => void;
}

const PERCENTAGE_THRESHOLDS = [40, 50, 60, 75];

export function PromoteStudentsModal({
  open,
  onOpenChange,
  fromAcademicYearId,
  fromAcademicYearName,
  toAcademicYearId,
  toAcademicYearName,
  classId,
  className,
  onSuccess,
}: PromoteStudentsModalProps) {
  const { toast } = useToast();
  const { dialog, confirm, close } = useConfirmDialog();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedThreshold, setSelectedThreshold] = useState(50);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isFinalClass, setIsFinalClass] = useState(false);
  const [nextClassId, setNextClassId] = useState<string | null>(null);
  const [nextClassName, setNextClassName] = useState<string>("");

  // Categorize students
  const eligibleStudents = students.filter(
    (s) => s.yearlyPercentage >= selectedThreshold && !s.tcIssued
  );
  const belowThresholdStudents = students.filter(
    (s) => s.yearlyPercentage < selectedThreshold && !s.tcIssued
  );
  const notEligibleStudents = students.filter((s) => s.tcIssued);

  // Summary counts
  const totalStudents = students.length;
  const eligibleCount = eligibleStudents.length;
  const belowThresholdCount = belowThresholdStudents.length;
  const tcIssuedCount = notEligibleStudents.length;

  // Load yearly summary data
  useEffect(() => {
    if (open && fromAcademicYearId && classId) {
      loadYearlySummary();
      detectFinalClass();
    } else {
      setStudents([]);
      setSelectedStudentIds(new Set());
    }
  }, [open, fromAcademicYearId, classId]);

  const loadYearlySummary = async () => {
    setLoadingData(true);
    try {
      const data = await academicYearsApi.getYearlySummary(fromAcademicYearId, classId);
      setStudents(data.students);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to load student data",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  };

  const detectFinalClass = async () => {
    try {
      // Get all classes to find the highest class number
      const { classesApi } = await import("@/lib/api");
      const allClasses = await classesApi.getAll();
      
      // Extract class numbers and find highest
      const classNumbers = new Set<number>();
      allClasses.forEach((c: any) => {
        const match = c.name.match(/\d+/);
        if (match) classNumbers.add(parseInt(match[0]));
      });
      const highestClassNumber = classNumbers.size > 0 ? Math.max(...Array.from(classNumbers)) : 0;

      // Check if current class is final
      const currentClassMatch = className.match(/\d+/);
      const currentClassNumber = currentClassMatch ? parseInt(currentClassMatch[0]) : 0;
      const isFinal = currentClassNumber === highestClassNumber && highestClassNumber > 0;

      setIsFinalClass(isFinal);

      if (!isFinal) {
        // Find next class (same section if possible, or first section of next class)
        const nextClassNumber = currentClassNumber + 1;
        const sectionMatch = className.match(/Section\s+(\w+)/i);
        const currentSection = sectionMatch ? sectionMatch[1] : null;

        // Try to find same section first
        let nextClass = allClasses.find(
          (c: any) => {
            const match = c.name.match(/\d+/);
            return match && parseInt(match[0]) === nextClassNumber && 
                   (currentSection ? c.section === currentSection : true);
          }
        );

        // If not found, get first section of next class
        if (!nextClass) {
          nextClass = allClasses.find((c: any) => {
            const match = c.name.match(/\d+/);
            return match && parseInt(match[0]) === nextClassNumber;
          });
        }

        if (nextClass) {
          setNextClassId(nextClass.id);
          setNextClassName(`${nextClass.name}${nextClass.section ? ` - Section ${nextClass.section}` : ''}`);
        }
      }
    } catch (error) {
      console.error("Error detecting final class:", error);
    }
  };

  const handleSelectAll = (category: "eligible" | "belowThreshold") => {
    const categoryStudents =
      category === "eligible" ? eligibleStudents : belowThresholdStudents;
    const allSelected = categoryStudents.every((s) =>
      selectedStudentIds.has(s.studentId)
    );

    if (allSelected) {
      // Deselect all in this category
      const newSet = new Set(selectedStudentIds);
      categoryStudents.forEach((s) => newSet.delete(s.studentId));
      setSelectedStudentIds(newSet);
    } else {
      // Select all in this category
      const newSet = new Set(selectedStudentIds);
      categoryStudents.forEach((s) => newSet.add(s.studentId));
      setSelectedStudentIds(newSet);
    }
  };

  const handleToggleStudent = (studentId: string) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setSelectedStudentIds(newSet);
  };

  const handlePromote = () => {
    if (selectedStudentIds.size === 0) {
      toast({
        title: "No Students Selected",
        description: "Please select at least one student to promote",
        variant: "destructive",
      });
      return;
    }

    const actionText = isFinalClass ? "graduate" : "promote";
    const targetText = isFinalClass
      ? "as Graduated"
      : `to ${nextClassName}`;

    confirm(
      `Confirm ${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Students`,
      `Are you sure you want to ${actionText} ${selectedStudentIds.size} selected student(s) ${targetText}? This action cannot be undone.`,
      async () => {
        await performPromotion();
      },
      {
        confirmText: isFinalClass ? "Graduate Students" : "Promote Students",
        variant: "default",
      }
    );
  };

  const performPromotion = async () => {
    setLoading(true);
    try {
      const result = await academicYearsApi.promote(fromAcademicYearId, {
        toAcademicYearId,
        classPromotions: [
          {
            fromClassId: classId,
            toClassId: isFinalClass ? null : nextClassId,
            studentIds: Array.from(selectedStudentIds),
          },
        ],
      });

      if (result.success) {
        const successMessage = isFinalClass
          ? `${result.graduatedCount} student(s) graduated successfully.`
          : `${result.promotedCount} student(s) promoted to ${nextClassName} successfully.`;

        toast({
          title: "Success",
          description: successMessage,
        });

        if (result.skippedCount > 0) {
          toast({
            title: "Some students were skipped",
            description: `${result.skippedCount} student(s) could not be processed.`,
            variant: "destructive",
          });
        }

        onOpenChange(false);
        onSuccess();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to promote students",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Promote Students – {className} – {fromAcademicYearName}
            </DialogTitle>
            <DialogDescription>
              Select students to promote to {toAcademicYearName}
            </DialogDescription>
          </DialogHeader>

          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden flex flex-col space-y-4">
              {/* Summary Section */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold">{totalStudents}</p>
                  <p className="text-xs text-muted-foreground">Total Students</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{eligibleCount}</p>
                  <p className="text-xs text-muted-foreground">Eligible</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{belowThresholdCount}</p>
                  <p className="text-xs text-muted-foreground">Below Threshold</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{tcIssuedCount}</p>
                  <p className="text-xs text-muted-foreground">TC Issued</p>
                </div>
              </div>

              {/* Percentage Filter */}
              <div className="space-y-2">
                <Label>Minimum Percentage Threshold</Label>
                <Select
                  value={selectedThreshold.toString()}
                  onValueChange={(val) => setSelectedThreshold(parseInt(val))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERCENTAGE_THRESHOLDS.map((threshold) => (
                      <SelectItem key={threshold} value={threshold.toString()}>
                        {threshold}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Final Class Warning */}
              {isFinalClass && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
                  <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      Final Class Detected
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      This is the final class. Selected students will be marked as Graduated and will not be enrolled in the next academic year.
                    </p>
                  </div>
                </div>
              )}

              {/* Student Lists */}
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6">
                  {/* Eligible Students */}
                  {eligibleStudents.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <h3 className="font-semibold">Eligible Students ({eligibleCount})</h3>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectAll("eligible")}
                        >
                          {eligibleStudents.every((s) =>
                            selectedStudentIds.has(s.studentId)
                          )
                            ? "Deselect All"
                            : "Select All"}
                        </Button>
                      </div>
                      <div className="space-y-2 pl-7">
                        {eligibleStudents.map((student) => (
                          <div
                            key={student.studentId}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={selectedStudentIds.has(student.studentId)}
                              onCheckedChange={() =>
                                handleToggleStudent(student.studentId)
                              }
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <p className="font-medium">{student.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Roll No: {student.rollNo || "N/A"}
                                </p>
                              </div>
                              <Badge variant="outline" className="ml-4">
                                {student.yearlyPercentage.toFixed(2)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Below Threshold */}
                  {belowThresholdStudents.length > 0 && (
                    <div className="space-y-3">
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                          <h3 className="font-semibold">
                            Below Threshold ({belowThresholdCount})
                          </h3>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectAll("belowThreshold")}
                        >
                          {belowThresholdStudents.every((s) =>
                            selectedStudentIds.has(s.studentId)
                          )
                            ? "Deselect All"
                            : "Select All"}
                        </Button>
                      </div>
                      <div className="space-y-2 pl-7">
                        {belowThresholdStudents.map((student) => (
                          <div
                            key={student.studentId}
                            className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={selectedStudentIds.has(student.studentId)}
                              onCheckedChange={() =>
                                handleToggleStudent(student.studentId)
                              }
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <p className="font-medium">{student.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Roll No: {student.rollNo || "N/A"}
                                </p>
                              </div>
                              <Badge variant="outline" className="ml-4 text-amber-600">
                                {student.yearlyPercentage.toFixed(2)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Not Eligible (TC Issued) */}
                  {notEligibleStudents.length > 0 && (
                    <div className="space-y-3">
                      <Separator />
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h3 className="font-semibold">
                          Not Eligible - TC Issued ({tcIssuedCount})
                        </h3>
                      </div>
                      <div className="space-y-2 pl-7">
                        {notEligibleStudents.map((student) => (
                          <div
                            key={student.studentId}
                            className="flex items-center gap-3 p-2 rounded opacity-60"
                          >
                            <Checkbox disabled checked={false} />
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <p className="font-medium">{student.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Roll No: {student.rollNo || "N/A"}
                                </p>
                              </div>
                              <Badge variant="outline" className="ml-4 text-red-600">
                                TC Issued
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {selectedStudentIds.size} student(s) selected
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePromote}
                    disabled={loading || selectedStudentIds.size === 0}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : isFinalClass ? (
                      <>
                        <GraduationCap className="w-4 h-4 mr-2" />
                        Graduate Students
                      </>
                    ) : (
                      `Promote to ${nextClassName}`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={dialog.open}
        onOpenChange={close}
        title={dialog.title}
        description={dialog.description}
        onConfirm={dialog.onConfirm}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        variant={dialog.variant}
      />
    </>
  );
}















