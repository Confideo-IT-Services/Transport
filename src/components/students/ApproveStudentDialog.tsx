import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import { studentsApi, classesApi } from '@/lib/api';
import { toast } from 'sonner';

export function ApproveStudentDialog({ 
  student, 
  open, 
  onClose, 
  onSuccess 
}: {
  student: any;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [classId, setClassId] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    if (open) {
      loadClasses();
      // Reset form
      setClassId('');
      setRollNo('');
    }
  }, [open]);

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

  const handleApprove = async () => {
    if (!classId) {
      toast.error('Please select a class');
      return;
    }

    setLoading(true);
    try {
      const result = await studentsApi.approve(student.id, { 
        classId, 
        rollNo: rollNo || undefined 
      });
      toast.success(result.message || 'Student approved and enrolled');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to approve student');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Approve & Assign Class</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label>Student</Label>
              <div className="mt-1 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium">{student.name}</p>
                {student.parentPhone && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Phone: {student.parentPhone}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label>Assign to Class *</Label>
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

            <div>
              <Label>Roll Number (Optional)</Label>
              <Input
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="Auto-assign if empty"
                type="number"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to auto-assign or set manually
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={loading || !classId} className="flex-1">
              {loading ? 'Approving...' : 'Approve & Enroll'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}





