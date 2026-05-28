from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware # <-- 1. IMPORT THE BOUNCER
from sqlalchemy.orm import Session
import hashlib
import uuid
from typing import List

# Import our custom structural layers
from database import engine, SessionLocal, Base
import models
import schemas
import auth

app = FastAPI()
models.Base.metadata.create_all(bind=engine)

# --- 2. ACTIVATE THE GUEST LIST (CORS) ---
# --- 2. ACTIVATE THE GUEST LIST (CORS) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://data-vault--adityayadav7459.replit.app",
        "https://data-vault--adityayadav7459.replit.app/",
        "http://localhost:3000",
        "http://localhost:5173",    # <-- ADDED YOUR LOCAL VITE PORT
        "http://127.0.0.1:5173"     # <-- ADDED THE IP EQUIVALENT
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security_lock = HTTPBearer()


# ... (Leave all your routes exactly as they are below this!)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def home():
    return {"message": "Welcome to EJ_Ent's Live API Backend!"}

# --- ACCOUNT OPERATIONS ---
@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    
    hashed_password = hashlib.sha256(user_data.password.encode()).hexdigest()
    new_user = models.User(email=user_data.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully!", "user_id": str(new_user.id)}

@app.post("/login")
def login_user(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Email or Password")
        
    input_password_hash = hashlib.sha256(login_data.password.encode()).hexdigest()
    if input_password_hash != user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Email or Password")
        
    token_payload = {"user_id": str(user.id), "email": user.email}
    access_token = auth.create_access_token(data=token_payload)
    
    return {"message": "Login successful!", "access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_lock), db: Session = Depends(get_db)):
    token_data = auth.verify_access_token(credentials.credentials)
    user = db.query(models.User).filter(models.User.id == token_data.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found.")
    return {"status": "Authorized Access Granted", "profile": {"id": user.id, "email": user.email, "tier": user.tier, "created_at": user.created_at}}


# --- NEW PHASE 3: CORE PROTECTED RECORD DOORS ---

# Door 1: Create a brand new record stamped with the logged-in user's tag
@app.post("/records", response_model=schemas.RecordResponse, status_code=status.HTTP_201_CREATED)
def create_new_record(
    record_input: schemas.RecordCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    # 1. Inspect and verify the swiped token card
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    # 2. Translate the input data into a physical rows row, stamping it with the owner's ID
    new_record = models.Record(
        title=record_input.title,
        description=record_input.description,
        user_id=uuid.UUID(current_user_id) # <-- FIX 1: Wrapped in UUID here!
    )
    
    # 3. Commit it to the PostgreSQL vault disk
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    return new_record

# Door 2: Fetch only the records that belong to THIS specific user
@app.get("/records", response_model=List[schemas.RecordResponse])
def get_my_records(
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    # 1. Inspect and verify the swiped token card
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    # 2. Query the vault: Fetch ONLY records where user_id matches the token card owner
    user_records = db.query(models.Record).filter(
        models.Record.user_id == uuid.UUID(current_user_id) # <-- FIX 2: Wrapped in UUID here!
    ).all()
    
    return user_records

# Door 3: Fetch ONE specific record by its ID safely
@app.get("/records/{record_id}", response_model=schemas.RecordResponse)
def get_single_record(
    record_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    # 1. Verify the swiped token keycard
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    # 2. Search the database for this specific record ID
    record = db.query(models.Record).filter(models.Record.id == record_id).first()
    
    # --- SCENARIO A: THE GHOST RECORD ---
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with ID {record_id} does not exist."
        )
        
    # --- SCENARIO B: THE SPY / DATA LEAK ---
    # Convert both IDs to strings to ensure an exact match check
    if str(record.user_id) != str(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not own this data record."
        )
        
    # 3. Access Verified! Hand over the single record data safely
    return record

# Door 4: Delete a specific record cleanly and securely
@app.delete("/records/{record_id}", status_code=status.HTTP_200_OK)
def delete_record(
    record_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    # 1. Decode the swiped keycard token
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    # 2. Locate the requested asset inside the vault
    record = db.query(models.Record).filter(models.Record.id == record_id).first()
    
    # --- SCENARIO A: DELETING A GHOST ---
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with ID {record_id} does not exist."
        )
        
    # --- SCENARIO B: THE MALICIOUS WIPER (IDOR ATTACK) ---
    if str(record.user_id) != str(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not have permission to delete this record."
        )
        
    # 3. Validation passed! Wipe the entry row from the vault disk
    db.delete(record)
    db.commit()
    
    return {"message": f"Record with ID {record_id} has been permanently deleted."}

# Door 5: Modify an existing record securely
@app.put("/records/{record_id}", response_model=schemas.RecordResponse)
def update_record(
    record_id: int,
    record_update: schemas.RecordUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    # 1. Decode the swiped keycard token
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    # 2. Locate the requested row entry inside the vault
    record = db.query(models.Record).filter(models.Record.id == record_id).first()
    
    # --- SCENARIO A: MODIFYING A GHOST RECORD ---
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with ID {record_id} does not exist."
        )
        
    # --- SCENARIO B: THE HIJACKER ATTACK (IDOR) ---
    if str(record.user_id) != str(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not have permission to modify this record."
        )
        
    # 3. Validation passed! Overwrite the existing row values with the new inputs
    record.title = record_update.title
    record.description = record_update.description
    
    # 4. Save the modifications back into the PostgreSQL vault disk
    db.commit()
    db.refresh(record)
    
    return record