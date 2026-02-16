import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Check } from 'lucide-react';
import { studentsApi, classesApi } from '@/lib/api';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

export function BulkApproveDialog({ 
  students, 
  open, 
  onClose, 
  onSuccess 
}: {
  students: any[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [classId, setClassId] = useState('');
  const [startingRollNo, setStartingRollNo] = useState('1');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      loadClasses();
      // Select all students by default
      setSelectedStudents(new Set(students.map(s => s.id)));
      setClassId('');
      setStartingRollNo('1');
    }
  }, [open, students]);

  const loadClasses = async () => {
    setLoadingClasses(true);
    try {
      const data = await classesApi.getAll();
      setClasses(data);
    } catch (error) {
      toast.error('Failed to load classes');
    } finally {
      setLoadingClasses(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(studentId)) {
      newSelected.delete(studentId);
    } else {
      newSelected.add(studentId);
    }
    setSelectedStudents(newSelected);
  };

  const selectAll = () => {
    setSelectedStudents(new Set(students.map(s => s.id)));
  };

  const deselectAll = () => {
    setSelectedStudents(new Set());
  };

  const handleBulkApprove = async () => {
    if (!classId) {
      toast.error('Please select a class');
      return;
    }

    if (selectedStudents.size === 0) {
      toast.error('Please select at least one student');
      return;
    }

    setLoading(true);
    try {
      const approvals = Array.from(selectedStudents).map((studentId, index) => ({
        studentId,
        classId,
        rollNo: startingRollNo ? parseInt(startingRollNo) + index : undefined
      }));

      const result = await studentsApi.bulkApprove(approvals);
      
      if (result.errors && result.errors.length > 0) {
        toast.warning(`Approved ${result.approved} student(s), ${result.failed} failed`);
      } else {
        toast.success(`✅ ${result.approved} student(s) approved and enrolled`);
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to approve students');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">Bulk Approve Students</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {selectedStudents.size} of {students.length} student(s) selected
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Class Assignment */}
          <div>
            <Label>Assign All to Class *</Label>
            <Select 
              value={classId} 
              onValueChange={setClassId}
              disabled={loadingClasses}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingClasses ? "Loading classes..." : "Select class"} />
              </SelectTrigger>
              <SelectContent>
                {classes.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}{cls.section ? ` - ${cls.section}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Starting Roll Number */}
          <div>
            <Label>Starting Roll Number</Label>
            <Input
              value={startingRollNo}
              onChange={(e) => setStartingRollNo(e.target.value)}
              placeholder="1"
              type="number"
              min="1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Roll numbers will be assigned sequentially starting from this number
            </p>
          </div>

          {/* Student Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Select Students</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {students.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedStudents.has(student.id)}
                    onCheckedChange={() => toggleStudent(student.id)}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{student.name}</p>
                    {student.parentPhone && (
                      <p className="text-xs text-muted-foreground">{student.parentPhone}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedStudents.size} student(s) will be approved
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkApprove} 
              disabled={loading || !classId || selectedStudents.size === 0}
            >
              <Check className="w-4 h-4 mr-2" />
              {loading ? 'Approving...' : `Approve ${selectedStudents.size} Student(s)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}







