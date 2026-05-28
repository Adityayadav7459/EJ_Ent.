from database import engine, Base
import models 

print("Attempting to connect to PostgreSQL and create tables...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully! EJ_Ent's foundation is laid.")